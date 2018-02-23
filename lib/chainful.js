var Chainful,
    libpath  = require('path'),
    crypto   = require('crypto'),
    Blast    = __Protoblast,
    fs       = require('fs'),
    Fn       = Blast.Bound.Function;

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
 */
Chainful.setMethod(function createGenesisBlock(callback) {

	var block = new Blast.Classes.Develry.Chainful.Block();

	// This is block 0
	block.index = 0;

	// There is no previous hash
	block.previous_hash = '';

	// Set the timestamp
	block.timestamp = Date.now();

	// Mine the block
	block.mine(this.difficulty, function mined(err, hash) {

		if (err) {
			return callback(err);
		}

		callback(null, block);
	});
});

/**
 * Mine pending transactions
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback
 */
Chainful.setMethod(function minePendingTransactions(callback) {

	var that = this,
	    block = new Blast.Classes.Develry.Chainful.Block(this.last_block),
	    pending = this.pending_transactions;

	// Reset the pending transactions
	this.pending_transactions = [];

	// Create the reference to the last block
	block.previous_hash = new Buffer(this.last_block.hash);

	// Set the timestamp
	block.timestamp = Date.now();

	// Set the transactions
	block.transactions = pending;

	// Actually mine the block
	block.mine(this.difficulty, function mined(err, hash) {

		if (err) {
			// Add these transactions again
			that.pending_transactions = that.pending_transactions.concat(pending);
			return callback(err);
		}

		callback(null, block);
	});
});

/**
 * See if the chain is valid
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback
 */
Chainful.setMethod(function isChainValid(callback) {

	var that = this,
	    last_index,
	    previous;

	Fn.forEach(this.chain, function checkBlock(block, index, next) {

		if (index == 0) {
			previous = block;
			return next();
		}

		previous.calculateHash(function gotHash(err, hash_buffer) {

			if (hash_buffer.equals(previous.hash)) {
				previous = block;
				return next();
			}

			last_index = index;
			return next(new Error('Chain is invalid at ' + index));
		});
	}, function done(err) {

		if (err) {
			return callback(err, false, last_index);
		}

		return callback(null, true, last_index);
	});
});

/**
 * Store the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {String}     target_dir
 * @param    {Function}   callback
 */
Chainful.setMethod(function storeChain(target_dir, callback) {

	var that = this,
	    cur_path,
	    per_file = 100,
	    cur_nr,
	    stream,
	    padded;

	Fn.forEach(this.chain, function storeBlock(block, index, next) {

		var target_file_nr = ~~(index / per_file);

		if (target_file_nr !== cur_nr) {
			cur_nr = target_file_nr;
			padded = Blast.Bound.Number.toPaddedString(cur_nr, 6);
			cur_path = libpath.join(target_dir, padded + '.chainful');

			// Close the existing stream
			if (stream) {
				stream.end();
			}

			stream = fs.createWriteStream(cur_path);
		}

		// @TODO: do some drain checking & such?
		stream.write(block.buffer);

		next();

	}, function done(err) {

		if (stream) {
			stream.end();
		}

		callback(err);
	});
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
 */
Chainful.setMethod(function loadChain(source_dir, callback) {

	var that = this,
	    names = [];

	Fn.series(function getFiles(next) {
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

				that.loadFileBuffer(file, next);
			});

		}, next);

	}, function done(err) {

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
Chainful.setMethod(function loadFileBuffer(file, callback) {

	var that = this,
	    contents,
	    hlength = 32,
	    offset = 0,
	    length,
	    index = 0,
	    check,
	    block,
	    hash;

	Fn.doWhile(function task(next) {

		// Store the previous found block in the correct position
		if (block) {
			that.chain[block.index] = block;
		}

		// Get the length of the contents
		length = 4 + file.readUInt16BE(offset) + 4;

		// Revive the block
		block = Blast.Classes.Develry.Chainful.Block.fromBuffer(file.slice(offset, offset + length), block, next);

		offset += length;
	}, function test() {
		return offset < file.length;
	}, function done(err) {

		if (err) {
			return callback(err);
		}

		if (block) {
			that.chain[block.index] = block;
		}

		callback(null);
	});
});