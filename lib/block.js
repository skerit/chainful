'use strict';

var ChainfulNS,
    crypto   = require('crypto'),
    Blast    = __Protoblast,
    Block,
    zlib     = require('zlib'),
    fs       = require('fs'),
    Fn       = Blast.Bound.Function;

// Get the namespace
ChainfulNS = Fn.getNamespace('Develry.Chainful');

/**
 * A block in the blockchain
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Chainful}   chainful
 * @param    {Develry.Chainful.Block}      parent
 */
Block = Fn.inherits('Informer', 'Develry.Chainful', function Block(chainful, parent) {

	// Reference the chainful instance
	this.chainful = chainful;

	// Reference to the parent block
	if (parent) {
		this.parent = parent;
	}
});

/**
 * The index of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Number}
 */
Block.setProperty(function index() {

	if (this._index == null && this.parent) {
		this._index = this.parent.index + 1;
	}

	return this._index;
}, function set_index(value) {
	return this._index = value;
});

/**
 * Did we mine this block locally?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type     {Boolean}
 */
Block.setProperty(function mined_locally() {
	return this._mined_locally || false;
});

/**
 * The parent of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type     {Develry.Chainful.Block}
 */
Block.setProperty(function parent() {

	// If this does not have a parent, but it does have an index number
	// and a reference to the chain, it's quite easy to get that parent
	if (this._parent == null && this._index && this.chainful) {
		this._parent = this.chainful.getByIndex(this._index - 1);
	}

	return this._parent;

}, function setParent(parent) {
	return this._parent = parent;
});

/**
 * The hash of the parent block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Block.setProperty(function parent_hash() {
	return this._parent_hash;
}, function setParentHash(value) {

	if (typeof value == 'string') {
		this._parent_hash_string = value;
		value = new Buffer(value, 'hex');
	}

	this.setDirty();
	this._parent_hash = value;
	return value;
});

/**
 * The hash of the parent block as a hex string
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {String}
 */
Block.setProperty(function parent_hash_string() {

	if (!this.parent_hash) {
		return '';
	}

	if (!this._parent_hash_string) {
		this._parent_hash_string = this.parent_hash.toString('hex');
	}

	return this._parent_hash_string;
}, function setParentHashByString(value) {
	this.parent_hash = value;
	return this._parent_hash_string;
});

/**
 * The timestamp of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Number}
 */
Block.setProperty(function timestamp() {
	return this._timestamp;
}, function setTimestamp(value) {
	this.setDirty();
	return this._timestamp = Number(value);
});

/**
 * The nonce of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Number}
 */
Block.setProperty(function nonce() {
	return this._nonce || 0;
}, function setNonce(value) {
	this.setDirty();
	return this._nonce = value;
});

/**
 * The transactions of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Number}
 */
Block.setProperty(function transactions() {

	if (!this._transactions) {
		this._transactions = [];
		this.setDirty();
	}

	return this._transactions;
}, function setTransactions(value) {

	value = Blast.Bound.Array.cast(value);

	this.setDirty();
	return this._transactions = value;
});

/**
 * The miner of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type     {Buffer}
 */
Block.setProperty(function miner() {

	var transaction;

	if (!this.transactions.length) {
		return null;
	}

	// There is no hash yet, so it doesn't have a miner
	if (!this.hash) {
		return null;
	}

	// Get the miner transaction
	transaction = this.transactions[0];

	if (transaction.data !== 'miner') {
		return null;
	}

	return transaction.owner;
});

/**
 * The transaction buffers of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @type     {Array}
 */
Block.setProperty(function transaction_buffers() {

	var result,
	    i;

	if (this._transaction_buffers) {
		return this._transaction_buffers;
	}

	result = [];

	for (i = 0; i < this.transactions.length; i++) {
		result[i] = this.transactions[i].buffer;
	}

	return result;
}, function setTransactionBuffers(value) {

	var transaction,
	    result,
	    buffer,
	    i;

	result = [];

	for (i = 0; i < value.length; i++) {
		buffer = value[i];

		// Create the transaction
		transaction = new ChainfulNS.Transaction(this.chainful);

		// Set its buffer
		transaction.buffer = buffer;

		result[i] = transaction;
	}

	// Store the original array here
	this._transaction_buffers = value;

	// And the new array with the real transactions here
	this._transactions = result;

	return value;
});

/**
 * The hash of this block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Block.setProperty(function hash() {
	return this._hash;
}, function setHash(value) {

	if (typeof value == 'string') {
		this._hash_string = value;
		value = new Buffer(value, 'hex');
	}

	this._hash = value;
	return value;
});

/**
 * The hash of the this block as a hex string
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @type     {String}
 */
Block.setProperty(function hash_string() {

	if (!this._hash_string && this.hash) {
		this._hash_string = this.hash.toString('hex');
	}

	return this._hash_string;
}, function setHashByString(value) {
	this.hash = value;
	return this._hash_string;
});

/**
 * The block as a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Block.setProperty(function buffer() {

	var length_buf,
	    contents,
	    result,
	    length;

	if (this._dirty) {
		throw new Error('Can not get buffer of a dirty block!');
	}

	if (!this.hash) {
		throw new Error('Can not get buffer of an unmined block!');
	}

	if (this._buffer) {
		return this._buffer;
	}

	if (!this._binary_contents) {
		throw new Error('Can not get buffer when binary contents are not generated');
	}

	// Create a new buffer
	contents = this._binary_contents;

	// Calculate the length of the contents
	length = contents.length + this.hash.length;

	// Create new buffer
	length_buf = new Buffer(4);

	// Write as a 16bit integer
	length_buf.writeInt16BE(length, 0);

	// Concatenate it
	// The order is length, contents, hash, length again
	result = Buffer.concat([length_buf, contents, this.hash, length_buf]);

	this._result = result;

	return result;
}, function setBuffer(file) {
	throw new Error('Please use the asynchronous `Block#setBuffer` instead');
});

/**
 * Revive a block from a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Buffer}                      buffer
 * @param    {Develry.Chainful.Chainful}   chainful
 * @param    {Develry.Chainful.Block}      parent
 * @param    {Function}                    callback
 *
 * @return   {Develry.Chainful.Block}
 */
Block.setStatic(function fromBuffer(buffer, chainful, parent, callback) {

	var block = new Block(chainful, parent);

	block.setBuffer(buffer, callback);

	if (block.parent == null && block.index) {
		block.parent = chainful.getByIndex(block.index - 1);
	}

	return block;
});

/**
 * Set this block as dirty
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Block.setMethod(function setDirty(value) {

	if (value == null) {
		value = true;
	}

	this._dirty = value;
	this._hash = null;
	this._transaction_buffers = null;

	return value;
});

/**
 * Set the contents of this block from a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Buffer}     chunk
 * @param    {Function}   callback
 */
Block.setMethod(function setBuffer(chunk, callback) {

	var that = this,
	    contents,
	    hlength = 32,
	    offset = 0,
	    length,
	    check,
	    hash;

	// Get the length of the contents
	length = chunk.readUInt16BE(offset) - hlength;

	// Increase the offset by 4
	offset += 4;

	// Get the contents
	contents = chunk.slice(offset, offset + length);

	// Increment the offset with the length
	offset += length;

	// Get the hash
	hash = chunk.slice(offset, offset + hlength);

	// Increment the offset again
	offset += hlength;

	// Get the length again
	check = chunk.readUInt16BE(offset) - hlength;

	// And increase the offset a final time
	offset += 4;

	if (length !== check) {
		throw new Error('Error reading buffer');
	}

	// Set the packed content buffer
	this.setPackedContents(contents, function decompressed(err, contents) {

		if (err) {
			return callback(err);
		}

		// Deserialize the contents
		contents = ChainfulNS.Chainful.unserialize(contents);

		that._index = contents[0];
		that._parent_hash = contents[1];
		that._timestamp = contents[2];
		that._nonce = contents[3];
		that.transaction_buffers = contents[4];
		that._hash = hash;

		// Also set the _buffer
		that._buffer = chunk;

		callback(null);
	});
});

/**
 * Generate the binary representation of this block's contents
 * And optionally compress them
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Function}   callback
 */
Block.setMethod(function getPackedContents(callback) {

	var that = this,
	    result,
	    data;

	if (!this._dirty && this._binary_contents) {
		return Blast.nextTick(callback, this, null, this._binary_contents);
	}

	if (this.index == null) {
		throw new Error('Can not create binary contents of a block that does not have an index');
	}

	data = [
		this.index,
		this.parent_hash,
		this.timestamp,
		this.nonce,
		this.transaction_buffers
	];

	result = ChainfulNS.Chainful.serialize(data);

	// Mark as not-dirty
	this._dirty = false;

	// Unset binary contents, because we're compressing them now
	this._binary_contents = null;

	// Compress the contents
	zlib.deflateRaw(result, function deflated(err, result) {

		if (err) {
			return callback(err);
		}

		that._binary_contents = result;

		callback(null, result);
	});
});

/**
 * Set the contents from a packed and compressed msgpack
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Buffer}     contents
 * @param    {Function}   callback
 */
Block.setMethod(function setPackedContents(contents, callback) {

	var that = this;

	if (!Buffer.isBuffer(contents)) {
		return Blast.nextTick(callback, this, new Error('First argument has to be a buffer'));
	}

	// "binary_contents" is the COMPRESSED buffer
	that._binary_contents = contents;

	zlib.inflateRaw(contents, function decompressed(err, result) {

		if (err) {
			return callback(err);
		}

		callback(null, result);
	});
});

/**
 * Calculate the hash and callback with a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Function}   callback
 */
Block.setMethod(function calculateHash(callback) {

	var that = this,
	    hash;

	this.getPackedContents(function gotContents(err, contents) {

		if (err) {
			return callback(err);
		}

		// Hash everything
		hash = crypto.createHash('sha256').update(contents).digest();

		callback(null, hash);
	});
});

/**
 * Mine the block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @param    {Number}     difficulty
 * @param    {Buffer}     private_key
 * @param    {Buffer}     public_key
 * @param    {Function}   callback
 *
 * @return   {Pledge}   A pledge promise
 */
Block.setMethod(function mine(difficulty, private_key, public_key, callback) {

	var that = this,
	    miner_transaction,
	    expectations = Array(difficulty + 1).join('0'),
	    pledge = new Blast.Classes.Pledge();

	// Indicate we created this block
	this._mined_locally = true;

	// Set the timestamp of this block
	this.timestamp = Date.now();

	// The first transaction should always be of the person who mined the block
	// And have the same timestamp
	miner_transaction = this.transactions[0];

	if (!miner_transaction || !miner_transaction.isOurMinerTransaction(this, public_key)) {

		// Create the miner transaction
		miner_transaction = this.chainful.createTransaction('miner');

		// And add it as the first transactions
		this.transactions.unshift(miner_transaction);
	}

	// Set the miner transaction to the same timestamp as the block
	miner_transaction.timestamp = this.timestamp;

	// Sign it with our private key
	miner_transaction.sign(private_key);

	// Calculate the hash
	this.calculateHash(function gotHash(err, hash_buffer) {

		var reality,
		    hash;

		if (err) {
			return pledge.reject(err);
		}

		hash = hash_buffer.toString('hex');
		reality = hash.substring(0, difficulty);

		if (reality !== expectations) {
			that.nonce++;
			return Blast.nextTick(that.calculateHash, that, gotHash);
		}

		that._hash = hash_buffer;

		pledge.resolve(hash);
	});

	if (callback) {
		pledge.handleCallback(callback);
	}

	return pledge;
});

/**
 * See if the transactions have valid signatures.
 *
 * Only tests the signatures of each transaction,
 * if you have specific transaction rules you should
 * set them using `Chainful#setBlockVerifier`.
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @return   {Boolean}
 */
Block.setMethod(function verifyTransactions() {

	var i;

	for (i = 0; i < this.transactions.length; i++) {
		if (!this.transactions[i].verify()) {
			return false;
		}
	}

	return true;
});

/**
 * See if the current block is the direct parent of the given block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Block}   block
 *
 * @return   {Boolean}
 */
Block.setMethod(function isParentOf(block) {

	// If this block's index is 1 lower then the given block
	// AND the hash of this block matches the parent_hash of the given block,
	// then this block is indeed a parent of the given block
	if (this.index == block.index - 1 && this.hash.equals(block.parent_hash)) {
		return true;
	}

	// Index and/or hashes don't match, so this is not a parent
	return false;
});

/**
 * See if the current block is the child of the given block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Block}   block
 *
 * @return   {Boolean}
 */
Block.setMethod(function isChildOf(block) {

	// If this block's index is 1 higher then the given block
	// AND the hash of this block matches the parent_hash of the given block,
	// then this block is indeed a parent of the given block
	if (this.index - 1 == block.index && this.parent_hash.equals(block.hash)) {
		return true;
	}

	// Index and/or hashes don't match, so this is not a child
	return false;
});

/**
 * See if the current block is older than the given block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Block}   block
 *
 * @return   {Boolean}
 */
Block.setMethod(function isOlderThan(block) {
	return this.index < block.index;
});

/**
 * See if the current block is the same as the given block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Block}   block
 *
 * @return   {Boolean}
 */
Block.setMethod(function equals(block) {
	if (this.index == block.index && this.hash.equals(block.hash)) {
		return true;
	}

	return false;
});

/**
 * See if this block contains the given transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Transaction}   their_transaction
 *
 * @return   {Boolean}
 */
Block.setMethod(function contains(their_transaction) {

	var ours,
	    i;

	// Iterate over all the transactions
	for (i = 0; i < this.transactions.length; i++) {
		ours = this.transactions[i];

		if (their_transaction.equals(ours)) {
			return true;
		}
	}

	return false;
});

/**
 * Return the transactions to the pending transactions array
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Block.setMethod(function releaseTransactions() {

	var re_add_transaction,
	    transaction_list = [],
	    start_index = this.index,
	    theirs,
	    block,
	    ours,
	    i,
	    j;

	if (this.equals(this.chainful.getByIndex(this.index))) {
		throw new Error('Can not release a block\'s transactions when it is still part of the chain');
	}

	// Now iterate over our transactions,
	// skipping the miner transaction
	for (i = 1; i < this.transactions.length; i++) {
		ours = this.transactions[i];

		// If this transaction is too old, just throw it away
		if (ours.is_old) {
			continue;
		}

		re_add_transaction = true;

		// See if this transaction is somewhere else in the chain
		for (j = this.index; j < this.chainful.length; j++) {
			block = this.chainful.getByIndex(i);

			if (block.contains(ours)) {
				re_add_transaction = false;
				break;
			}
		}

		if (re_add_transaction) {
			this.chainful.pending_transactions.push(ours);
		}
	}
});