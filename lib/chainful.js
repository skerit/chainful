'use strict';

var ChainfulNS,
    Chainful,
    jsrsasign = require('jsrsasign'),
    msgpack   = require('msgpack'),
    libpath   = require('path'),
    crypto    = require('crypto'),
    Blast     = __Protoblast,
    fs        = require('fs'),
    Fn        = Blast.Bound.Function;

// Get the namespace
ChainfulNS = Fn.getNamespace('Develry.Chainful');

/**
 * The Chainful blockchain class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 */
Chainful = Fn.inherits('Informer', 'Develry.Chainful', function Chainful() {

	// The actual chain of blocks
	this.chain = new ChainfulNS.Blockchain(this);

	// Other possible chains
	this.forks = [];

	// The blocks by hash
	this.blocks_by_hash = new Map();

	// The blocks by parent hash
	this.blocks_by_parent = new Map();

	// Blocks being proposed
	this.blocks_being_proposed = new Map();

	// The default difficulty
	this.difficulty = 2;

	// Transactions waiting to get in a block
	this.pending_transactions = [];

	// New block verification function
	this.block_verifier = null;

	// Block requester function
	this.block_requester = null;
});

/**
 * Convert the value to a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Object}   value
 *
 * @return   {Buffer}
 */
Chainful.setStatic(function serialize(value) {
	return msgpack.pack(value);
});

/**
 * Convert the buffer back to a value
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Buffer}   value
 *
 * @return   {Object}
 */
Chainful.setStatic(function unserialize(value) {
	return msgpack.unpack(value);
});

/**
 * The current last block in the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 */
Chainful.setProperty(function last_block() {
	return this.chain.last_block;
});

/**
 * Get the length of the current chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Chainful.setProperty(function length() {
	return this.chain.length;
});

/**
 * Create the genesis block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Buffer}     private_key
 * @param    {Buffer}     public_key
 * @param    {Function}   callback
 *
 * @return   {Pledge}     A pledge promise
 */
Chainful.setMethod(function createGenesisBlock(private_key, public_key, callback) {

	var block = new ChainfulNS.Block(this),
	    pledge = new Blast.Classes.Pledge();

	// This is block 0
	block.index = 0;

	// There is no previous hash
	block.parent_hash = '';

	// Set the timestamp
	block.timestamp = Date.now();

	// Mine the block
	block.mine(this.difficulty, private_key, public_key, function mined(err, hash) {

		if (err) {
			pledge.reject(err);
			return callback(err);
		}

		pledge.resolve(hash);
		callback(null, block);
	});

	return pledge;
});

/**
 * Mine pending transactions
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Function}   callback
 *
 * @return   {Pledge}     A pledge promise
 */
Chainful.setMethod(function minePendingTransactions(private_key, public_key, callback) {

	var that = this,
	    block,
	    pending,
	    pledge = new Blast.Classes.Pledge();

	pledge.handleCallback(callback);

	// Drop pending transactions that are too old
	this.dropOldPendingTransactions();

	// If there are no more pending transactions, do nothing
	if (this.pending_transactions.length == 0) {
		return Blast.nextTick(pledge.reject, pledge, new Error('There are no transactions to add to block'));
	}

	// Get the pending transactions
	pending = this.pending_transactions;

	// Reset the pending transactions
	this.pending_transactions = [];

	// Create a new block
	block = new ChainfulNS.Block(this, this.last_block);

	// Create the reference to the last block
	block.parent_hash = new Buffer(this.last_block.hash);

	// Set the transactions
	block.transactions = pending;

	// Actually mine the block
	block.mine(this.difficulty, private_key, public_key).then(function mined(hash) {
		pledge.resolve(block);
	}).catch(function mineError(err) {
		// Add these transactions again
		that.pending_transactions = that.pending_transactions.concat(pending);

		pledge.reject(err);
	});

	return pledge;
});

/**
 * Drop old pending transactions
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Chainful.setMethod(function dropOldPendingTransactions() {

	var transaction,
	    i;

	// Now iterate over our transactions,
	// skipping the miner transaction
	for (i = this.pending_transactions.length - 1; i >= 0; i--) {
		transaction = this.pending_transactions[i];

		// If this transaction is too old, just throw it away
		if (transaction.is_old) {
			this.pending_transactions.splice(i, 1);
			continue;
		}
	}

});

/**
 * Set the block verifier function:
 * this is custom logic you want the blocks in your chain to adhere to
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Function}   verifier_function
 */
Chainful.setMethod(function setBlockVerifier(verifier_function) {
	this.block_verifier = verifier_function;
	this.emit('got_block_verifier', verifier_function, null);
});

/**
 * Set the block requester function:
 * this function will receive requests to fetch new blocks
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Function}   requester_function
 */
Chainful.setMethod(function setBlockRequester(requester_function) {
	this.block_requester = requester_function;
	this.emit('got_block_requester', requester_function, null);
});

/**
 * See if the chain is valid
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Function}   callback   An old style callback that also gets the index on error
 *
 * @return   {Pledge}     A pledge promise
 */
Chainful.setMethod(function isValid(callback) {
	return this.chain.isValid(callback);
});

/**
 * Get a fork for the given block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Block}   block
 *
 * @return   {Develry.Chainful.Blockchain}
 */
Chainful.setMethod(function getFork(block) {

	var fork,
	    i;

	// See if this fork exists already
	for (i = 0; i < this.forks.length; i++) {
		fork = this.forks[i];

		if (!fork.blocks[0]) {
			continue;
		}

		// Test the first block in this fork
		// (Don't use `getByIndex` here)
		if (block.equals(fork.blocks[0])) {
			return fork;
		}
	}

	// Nope, we need to create a new fork
	fork = new ChainfulNS.Blockchain(this);

	// Indicate this forked chain doesn't start at 0
	fork.start_index = block.index;

	// Add this block
	fork.add(block);

	// Add this fork to the forks array
	this.forks.push(fork);

	return fork;
});

/**
 * Store the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {String|Stream}     target
 * @param    {Function}          callback
 *
 * @return   {Pledge}   A pledge promise
 */
Chainful.setMethod(function storeChain(target, callback) {

	var that = this,
	    is_stream,
	    cur_path,
	    per_file = 100,
	    cur_nr,
	    stream,
	    padded,
	    pledge = new Blast.Classes.Pledge();

	pledge.handleCallback(callback);

	if (typeof target == 'string') {
		is_stream = false;
	} else {
		is_stream = true;
		stream = target;
	}

	Fn.forEach(this.chain.blocks, function storeBlock(block, index, next) {

		var target_file_nr;

		// Only create streams if we receive a path
		if (!is_stream) {
			target_file_nr = ~~(index / per_file);

			if (target_file_nr !== cur_nr) {
				cur_nr = target_file_nr;
				padded = Blast.Bound.Number.toPaddedString(cur_nr, 6);
				cur_path = libpath.join(target, padded + '.chainful');

				// Close the existing stream
				if (stream) {
					stream.end();
				}

				stream = fs.createWriteStream(cur_path);
			}
		}

		// @TODO: do some drain checking & such?
		stream.write(block.buffer);

		next();

	}, function done(err) {

		if (stream) {
			return stream.end(function finished(stream_err) {
				if (err) {
					pledge.reject(err);
				} else if (stream_err) {
					pledge.reject(err);
				} else {
					pledge.resolve();
				}
			});
		}

		if (err) {
			pledge.reject(err);
		} else {
			pledge.resolve();
		}
	});

	return pledge;
});

/**
 * Load the chain from a certain directory
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {String}     source_dir
 * @param    {Function}   callback
 *
 * @return   {Pledge}   A pledge promise
 */
Chainful.setMethod(function loadChain(source_dir, callback) {

	var that = this,
	    names = [],
	    pledge = new Blast.Classes.Pledge();

	return Fn.series(function getFiles(next) {
		fs.readdir(source_dir, function gotEntries(err, entries) {

			var entry,
			    i;

			if (err) {
				return next(err);
			}

			for (i = 0; i < entries.length; i++) {
				entry = entries[i];

				if (entry.endsWith('.chainful')) {
					names.push(entry);
				}
			}

			next();
		});
	}, function loadFiles(next) {

		// Sort them
		names.sort(function doSort(a, b) {
			return Number(a) - Number(b);
		});

		Fn.forEach(names, function loadFile(name, index, next) {

			fs.readFile(libpath.resolve(source_dir, name), function gotFile(err, file) {

				if (err) {
					return next(err);
				}

				that.loadFromBuffer(file, next);
			});

		}, next);

	}, function done(err) {

		if (!callback) {
			return;
		}

		if (err) {
			return callback(err);
		}

		callback(null);
	});
});

/**
 * Load blocks in a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Buffer}     file
 * @param    {Function}   callback
 */
Chainful.setMethod(function loadFromBuffer(file, callback) {

	var that = this,
	    contents,
	    offset = 0,
	    length,
	    block;

	Fn.doWhile(function task(next) {

		// Store the previous found block in the correct position
		if (block) {
			that.addBlock(block);
		}

		// Get the length of the contents
		length = 4 + file.readUInt16BE(offset) + 4;

		// Get the contents piece
		contents = file.slice(offset, offset + length);

		// Revive the block
		block = ChainfulNS.Block.fromBuffer(contents, that, block, next);

		offset += length;
	}, function test() {
		return offset < file.length;
	}, function done(err) {

		if (err) {
			return callback(err);
		}

		if (block) {
			that.addBlock(block);
		}

		callback(null);
	});
});

/**
 * Get the chain this block is a part of.
 * But don't create a new block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}      block
 */
Chainful.setMethod(function getChainOfBlock(block) {

	var parent,
	    fork,
	    temp,
	    i;

	// Get the possible parent of this block
	parent = this.getByIndex(block.index - 1);

	// The found block is a parent of the given block.
	// This still means the new block could be the start of a new chain
	if (parent && parent.isParentOf(block)) {
		temp = this.getByIndex(block.index);

		// If there is no new index, or the 
		// block found equals the given block the main chain is the one we want
		if (!temp || temp.equals(block)) {
			return this.chain;
		}
	}

	for (i = 0; i < this.forks.length; i++) {
		fork = this.forks[i];

		// If this block is in the fork, return the fork!
		if (fork.isTargetChainOf(block)) {
			return fork;
		}
	}

	return this.chain;
});

/**
 * Actually add the given block to the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Block}      block
 * @param    {Blockchain} target_chain
 */
Chainful.setMethod(function addBlock(block, target_chain) {

	if (block.index == null) {
		throw new Error('Can not add block that has no index');
	}

	if (!target_chain) {
		target_chain = this.chain;
	}

	// Add it by the index
	target_chain.add(block);

	// And by the hash
	this.blocks_by_hash.set(block.hash_string, block);

	// If this block is still in the 'being proposed' map, remove if
	if (this.blocks_being_proposed.has(block.index)) {
		this.blocks_being_proposed.delete(block.index);
	}

	// Don't add genesis block to a parent
	if (!block.parent_hash) {
		return;
	}

	if (!this.blocks_by_parent.get(block.parent_hash_string)) {
		this.blocks_by_parent.set(block.parent_hash_string, [block]);
	} else {
		this.blocks_by_parent.get(block.parent_hash_string).push(block);
	}
});

/**
 * Request a chain update
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Function}   callback
 *
 * @return   {Pledge}
 */
Chainful.setMethod(function requestUpdate(callback) {

	var that = this,
	    pledge = new Blast.Classes.Pledge(),
	    new_blocks = [],
	    i;

	pledge.handleCallback(callback);

	// Request new blocks
	this.requestBlocks(function gotBlocks(err, blocks) {

		if (err) {
			return pledge.reject(err);
		}

		if (!blocks.length) {
			return pledge.resolve(false);
		}

		pledge.resolve(that.proposeBlocks(blocks));
	});

	return pledge;
});

/**
 * Request blocks but don't add them yet
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Array}      block_indexes   An array of block indexes to request
 * @param    {Function}   callback
 *
 * @return   {Pledge}     Resolves to an array of Block objects
 */
Chainful.setMethod(function requestBlocks(block_indexes, callback) {

	var that = this,
	    pledge = new Blast.Classes.Pledge(),
	    result_blocks = [],
	    new_blocks = [],
	    i;

	if (typeof block_indexes == 'function') {
		callback = block_indexes;
		block_indexes = undefined;
	}

	pledge.handleCallback(callback);

	// Make sure the requested blocks indexes variable is an array
	block_indexes = Blast.Bound.Array.cast(block_indexes);

	// Remove anything we already have
	for (i = block_indexes.length - 1; i >= 0; i--) {
		// If we already have one of the blocks, skip requesting it again
		if (that.blocks_being_proposed.has(i)) {

			// Add this one to the `new_blocks` array
			new_blocks.push(that.blocks_being_proposed.get(i));

			// Remove it from the request
			block_indexes.splice(i, 1);
		}
	}

	Fn.series(function doRequest(next) {

		if (!that.block_requester) {
			return next(new Error('This chain does not have a block requester function'));
		}

		// Request new blocks
		that.block_requester(block_indexes, that.last_block, function doneRequest(err, response) {

			if (err) {
				return next(err);
			}

			// Add the received blocks to the new blocks array
			new_blocks = response.concat(response);

			next();
		});
	}, function convertBuffers(next) {

		var tasks = [];

		new_blocks.forEach(function eachBlock(block, index) {

			if (!Buffer.isBuffer(block)) {
				result_blocks[index] = block;
				return next();
			}

			tasks.push(function parseBuffer(next) {
				// Turn the buffer into a block
				block = ChainfulNS.Block.fromBuffer(block, that, null, function done(err) {

					if (err) {
						return next(err);
					}

					// Store them in the new array
					result_blocks[index] = block;

					next();
				});
			});
		});

		Fn.parallel(tasks, next);

	}, function done(err) {

		if (err) {
			return pledge.reject(err);
		}

		// Sort the blocks by ascending index
		Blast.Bound.Array.sortByPath(result_blocks, 1, 'index');

		pledge.resolve(result_blocks);
	});

	return pledge;
});

/**
 * Propose to add a list of blocks to the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Array}     input_blocks   An array of Block objects
 * @param    {Function}  callback
 *
 * @return   {Pledge}    Resolves with proposed blocks
 */
Chainful.setMethod(function proposeBlocks(input_blocks, callback) {

	var that = this,
	    pledge = new Blast.Classes.Pledge();

	pledge.handleCallback(callback);

	Fn.series(function addBlocks(next) {

		var tasks = [];

		// Iterate over the proposed blocks and add them one by one
		input_blocks.forEach(function eachBlock(block) {
			tasks.push(function proposeSingleBlockTask(next) {
				that.proposeBlock(block, next);
			});
		});

		Fn.series(tasks, next);

	}, function done(err, result) {

		if (err) {
			return pledge.reject(err);
		}

		// Flatten the result array
		result = Blast.Bound.Array.flatten(result);

		pledge.resolve(result);
	});

	return pledge;
});
var ccount = 0;
/**
 * Propose to add this block to the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}     block
 * @param    {Function}  callback
 *
 * @return   {Pledge}
 */
Chainful.setMethod(function proposeBlock(block, callback) {

	var that = this,
	    pledge = new Blast.Classes.Pledge(),
	    fork;

	pledge.handleCallback(callback);

	Fn.series(function ensureBlock(next) {
		if (Buffer.isBuffer(block)) {
			// We pass `null` as parent because we don't know what it is yet!
			block = ChainfulNS.Block.fromBuffer(block, that, null, next);
		} else {
			next();
		}
	}, function done(err) {

		var request_indexes,
		    target_chain = that.chain,
		    i;

		if (err) {
			return pledge.reject(err);
		}

		// Store this block in the `blocks_being proposed` map
		that.blocks_being_proposed.set(block.index, block);

		// If this is the genesis block, accept it
		if (block.index == 0) {
			if (that.last_block) {
				pledge.resolve(null);
			} else {
				that.verifyProposedBlock(block, function verified(err) {

					if (err) {
						return pledge.reject(err);
					}

					that.addBlock(block);
					pledge.resolve(block);
				});
			}

			return;
		}

		// Get the target chain of this block
		// (maybe we can already for its possible fork)
		target_chain = that.getChainOfBlock(block);

		if (block.isOlderThan(target_chain.last_block) || block.equals(target_chain.last_block)) {
			// We already have this block, so do nothing.
			// Resolve the pledge promise on the next tick
			pledge.resolve(null);
		} else if (block.isChildOf(target_chain.last_block)) {
			// This is the next block in the chain, so verify and accept
			target_chain.verifyProposedBlock(block, function verified(err) {

				if (err) {
					return pledge.reject(err);
				}

				// Success! It's a valid block
				that.addBlock(block, target_chain);

				// Resolve the pledge
				pledge.resolve(block);
			});
		} else if (block.index > target_chain.last_block.index) {
			// The proposed block is newer than anything we have,
			// so we need to get the blocks we're missing
			request_indexes = [];

			// See which blocks we need to request
			for (i = block.index; i > target_chain.last_block.index || 0; i--) {
				request_indexes.push(i);
			}

			that.requestBlocks(request_indexes, function done(err, blocks) {

				if (err) {
					pledge.reject(err);
				}

				pledge.resolve(that.proposeBlocks(blocks));

			});
		} else if (block.index == target_chain.last_block.index) {

			// We received a block that has the same index,
			// but a different hash. So this is some kind of fork!
			fork = that.getFork(block);

			// Indicate this block is part of this fork
			block.fork = fork;

			// Verify this block in that fork
			fork.verifyProposedBlock(block, function verified(err) {

				if (err) {
					return pledge.reject(err);
				}

				// Success! It's a valid block for this fork
				// (If the fork was created because of this block,
				// it'll already have this block. But that's ok,
				// because the `add` method sets by index)
				fork.add(block);

				// Resolve the pledge
				pledge.resolve(block);
			});
		} else {
			throw new Error('No idea what to do with this block');
		}
	});

	return pledge;
});

/**
 * Verify a proposed block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}     block
 * @param    {Function}  callback
 */
Chainful.setMethod(function verifyProposedBlock(block, callback) {
	return this.chain.verifyProposedBlock(block, callback);
});

/**
 * Create a new transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Object}   data
 *
 * @return   {Develry.Chainful.Transaction}
 */
Chainful.setMethod(function createTransaction(data) {

	var transaction = new ChainfulNS.Transaction(this);

	// Set the data of the transaction
	transaction.data = data;

	// Set the timestamp
	transaction.timestamp = Date.now();

	return transaction;
});

/**
 * Create, sign and add a new transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   data
 * @param    {Buffer}   private_key
 *
 * @return   {Develry.Chainful.Transaction}
 */
Chainful.setMethod(function addTransaction(data, private_key) {

	var transaction = this.createTransaction(data);

	// Sign it
	transaction.sign(private_key);

	// Push the transaction
	this.pending_transactions.push(transaction);

	return transaction;
});

/**
 * Get a block by its hash
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {String|Buffer}     hash
 */
Chainful.setMethod(function getByHash(hash) {

	if (typeof hash != 'string') {
		hash = hash.toString('hex');
	}

	return this.blocks_by_hash.get(hash);
});

/**
 * Get a block by its index
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Number}   index
 */
Chainful.setMethod(function getByIndex(index) {
	return this.chain.getByIndex(index);
});

/**
 * Get the children of a block
 * This should be only 1 child, but can be more when a fork happens
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {String|Buffer}     hash
 */
Chainful.setMethod(function getChildren(hash) {
	return this.blocks_by_parent.get(hash) || [];
});

/**
 * Sign something
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Buffer}    buffer
 * @param    {String}    private_key_hex
 *
 * @return   {String}    The hexadecimal signature string
 */
Chainful.setMethod(function signBuffer(buffer, private_key_hex) {

	var signature,
	    signer;

	if (typeof private_key_hex != 'string') {
		private_key_hex = private_key_hex.toString('hex');
	}

	// Create the signature object
	signer = new jsrsasign.Signature({alg: 'SHA256withECDSA'});

	// Initialize it
	signer.init({d: private_key_hex, curve: 'secp256k1'});

	// Update the signature
	signer.updateHex(buffer.toString('hex'));

	// And return the signature
	signature = signer.sign();

	return signature;
});

/**
 * Verify something
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Buffer}    buffer
 * @param    {String}    signature
 * @param    {String}    public_key_hex
 *
 * @return   {Boolean}
 */
Chainful.setMethod(function verifyBuffer(buffer, signature, public_key_hex) {

	var unsigner,
	    result,
	    ecdh;

	if (!public_key_hex) {
		throw new Error('Can not verify buffer without public key!');
	}

	if (typeof public_key_hex != 'string') {
		public_key_hex = public_key_hex.toString('hex');
	}

	// We have to uncompress the public key first.
	// We do this using the (unfortunately) deprecated `ecdh.setPublicKey` method
	// If it disappears it can also be done using the `elliptic` module,
	// but that's overkill now
	if (public_key_hex.length < 100) {
		ecdh = crypto.createECDH('secp256k1')

		// Use the compressed public key to set the public key
		ecdh.setPublicKey(public_key_hex, 'hex');

		// Get the uncompressed key
		public_key_hex = ecdh.getPublicKey('hex');
	}

	// Create the signature object
	unsigner = new jsrsasign.Signature({alg: 'SHA256withECDSA'});

	// Initialize it
	unsigner.init({xy: public_key_hex, curve: 'secp256k1'});

	// Update the signature
	unsigner.updateHex(buffer.toString('hex'));

	// And return the signature
	result = unsigner.verify(signature);

	return result;
});

/**
 * Resolve conflicts
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Function}   callback
 *
 * @return   {Pledge}
 */
Chainful.setMethod(function resolveConflicts(callback) {

	var that = this,
	    pledge,
	    switched = null;

	pledge = Fn.series(function validateChain(next) {
		that.isValid(next);
	}, function checkForks(next) {

		var tasks = [];

		if (that.forks.length === 0) {
			next();
		}

		that.forks.forEach(function eachFork(fork, index) {
			tasks.push(function checkFork(next) {
				fork.isValid(function isValid(err, result) {

					// Just remove invalid forks
					if (err) {
						that.forks[index] = null;
						return next();
					}

					next();
				});
			});
		});

		Fn.parallel(tasks, function checkedAllForks(err) {

			var longer_amount,
			    fork;

			if (err) {
				return next(err);
			}

			// Remove null values from the forks array
			Blast.Bound.Array.clean(that.forks, null);

			// Sort the forks by their descending length
			Blast.Bound.Array.sortByPath(that.forks, -1, 'length');

			// Get the first fork
			fork = that.forks[0];

			if (!fork) {
				return next();
			}

			// See if it is longer, and if it is, how much
			longer_amount = fork.isLongerThan(that.chain);

			if (longer_amount) {
				if (longer_amount > 6 || (that.last_block && that.last_block.mined_locally)) {

					// Overwrite the main chain with the blocks in this fork
					// Overwritten blocks will have their transactions released
					switched = fork.overwriteMainChain();
				}
			}

			if (switched == null) {
				switched = false;
			}

			next();
		});

	}, function done(err) {

		if (err) {
			return;
		}

		return switched;
	});

	// Handle old-style callbacks
	pledge.handleCallback(callback);

	return pledge;
});