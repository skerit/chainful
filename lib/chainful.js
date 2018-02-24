var ChainfulNS,
    Chainful,
    jsrsasign = require('jsrsasign'),
    elliptic  = require('elliptic'),
    libpath   = require('path'),
    crypto    = require('crypto'),
    Blast     = __Protoblast,
    ec        = new elliptic.ec('secp256k1'),
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
 * @version  0.1.0
 */
Chainful = Fn.inherits('Informer', 'Develry.Chainful', function Chainful() {

	// The actual chain of blocks
	this.chain = [];

	// The blocks by hash
	this.blocks_by_hash = new Map();

	// The blocks by parent hash
	this.blocks_by_parent = new Map();

	// The default difficulty
	this.difficulty = 2;

	// Transactions waiting to get in a block
	this.pending_transactions = [];
});

/**
 * The last block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Chainful.setProperty(function last_block() {
	return this.chain[this.chain.length - 1];
});

/**
 * Create the genesis block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback
 *
 * @return   {Pledge}     A pledge promise
 */
Chainful.setMethod(function createGenesisBlock(callback) {

	var block = new ChainfulNS.Block(this),
	    pledge = new Blast.Classes.Pledge();

	// This is block 0
	block.index = 0;

	// There is no previous hash
	block.parent_hash = '';

	// Set the timestamp
	block.timestamp = Date.now();

	// Mine the block
	block.mine(this.difficulty, function mined(err, hash) {

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
 * @version  0.1.0
 *
 * @param    {Function}   callback
 *
 * @return   {Pledge}     A pledge promise
 */
Chainful.setMethod(function minePendingTransactions(callback) {

	var that = this,
	    block = new ChainfulNS.Block(this, this.last_block),
	    pending = this.pending_transactions,
	    pledge = new Blast.Classes.Pledge();

	// Reset the pending transactions
	this.pending_transactions = [];

	// Create the reference to the last block
	block.parent_hash = new Buffer(this.last_block.hash);

	// Set the timestamp
	block.timestamp = Date.now();

	// Set the transactions
	block.transactions = pending;

	// Actually mine the block
	block.mine(this.difficulty).then(function mined(hash) {
		pledge.resolve(block);
	}).catch(function mineError(err) {
		// Add these transactions again
		that.pending_transactions = that.pending_transactions.concat(pending);

		pledge.reject(err);
	});

	if (callback) {
		pledge.handleCallback(callback);
	}

	return pledge;
});

/**
 * See if the chain is valid
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback   An old style callback that also gets the index on error
 *
 * @return   {Pledge}     A pledge promise
 */
Chainful.setMethod(function isValid(callback) {

	var that = this,
	    last_index,
	    previous,
	    pledge = new Blast.Classes.Pledge();

	Fn.forEach(this.chain, function checkBlock(block, index, next) {

		if (index == 0) {
			previous = block;
			return next();
		}

		if (!block.verifyTransactions()) {
			return next(new Error('Chain contains invalid transactions at ' + index));
		}

		previous.calculateHash(function gotHash(err, hash_buffer) {

			last_index = index;

			if (hash_buffer.equals(previous.hash)) {
				previous = block;
				return next();
			}

			return next(new Error('Chain contains invalid block at ' + index));
		});
	}, function done(err) {

		if (err) {
			if (callback) {
				callback(err, false, last_index);
			}
			return pledge.reject(err);
		}

		if (callback) {
			callback(null, true, last_index);
		}

		pledge.resolve(last_index);
	});

	return pledge;
});

/**
 * Store the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
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

	if (callback) {
		pledge.handleCallback(callback);
	}

	if (typeof target == 'string') {
		is_stream = false;
	} else {
		is_stream = true;
		stream = target;
	}

	Fn.forEach(this.chain, function storeBlock(block, index, next) {

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
 * Add a block to the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Block}   block
 */
Chainful.setMethod(function addBlock(block) {

	if (block.index == null) {
		throw new Error('Can not add block that has no index');
	}

	// Add it by the index
	this.chain[block.index] = block;

	// And by the hash
	this.blocks_by_hash.set(block.hash_string, block);

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
 * Create a new transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Object}   data
 *
 * @return   {Develry.Chainful.Transaction}
 */
Chainful.setMethod(function createTransaction(data) {

	var transaction = new ChainfulNS.Transaction(this);

	// Set the data of the transaction
	transaction.data = data;

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
	return this.chain[index];
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
 * @version  0.1.0
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

	lastsigned = buffer;

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
 * @version  0.1.0
 *
 * @param    {Buffer}    buffer
 * @param    {String}    signature
 * @param    {String}    public_key_hex
 *
 * @return   {Boolean}
 */
Chainful.setMethod(function verifyBuffer(buffer, signature, public_key_hex) {

	var unsigner,
	    result;

	if (!public_key_hex) {
		throw new Error('Can not verify buffer without public key!');
	}

	if (typeof public_key_hex != 'string') {
		public_key_hex = public_key_hex.toString('hex');
	}


	// We have to uncompress the public key first.
	// Node & jsrsasign can't do this, so we need elliptic for that :/
	if (public_key_hex.length < 100) {
		public_key_hex = ec.keyFromPublic(public_key_hex, 'hex').getPublic(false, 'hex');
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