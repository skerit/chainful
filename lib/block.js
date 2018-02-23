var crypto   = require('crypto'),
    Blast    = __Protoblast,
    Block,
    BSON     = require('bson'),
    bson     = new BSON(),
    fs       = require('fs'),
    Fn       = Blast.Bound.Function;

/**
 * A block in the blockchain
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Block = Fn.inherits('Informer', 'Develry.Chainful', function Block() {});

/**
 * The hash of the previous block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Block.setProperty(function previous_hash() {
	return this._previous_hash;
}, function setPreviousHash(value) {

	if (typeof value == 'string') {
		value = new Buffer(value, 'hex');
	}

	this.setDirty();
	this._previous_hash = value;
	return value;
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
		this._dirty = true;
	}

	return this._transactions;

}, function setTransactions(value) {

	value = Blast.Bound.Array.cast(value);

	this.setDirty();
	return this._transactions = value;
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
		value = new Buffer(value, 'hex');
	}

	this._hash = value;
	return value;
});

/**
 * The bson representation of this block's contents
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Block.setProperty(function bson_contents() {

	if (this._dirty || !this._bson_contents) {
		this._bson_contents = this.generateBsonContents();
		this._dirty = false;
	}

	return this._bson_contents;
}, function setBsonContents(value) {
	return this._bson_contents = value;
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

	// Create a new bson buffer
	contents = this.generateBsonContents();

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

	var contents,
	    hlength = 32,
	    offset = 0,
	    length,
	    check,
	    hash;

	// Get the length of the contents
	length = file.readUInt16BE(offset) - hlength;

	// Increase the offset by 4
	offset += 4;

	// Get the contents 
	contents = file.slice(offset, offset + length);

	// Increment the offset with the length
	offset += length;

	// Get the hash
	hash = file.slice(offset, offset + hlength);

	// Increment the offset again
	offset += hlength;

	// Get the length again
	check = file.readUInt16BE(offset) - hlength;

	// And increase the offset a final time
	offset += 4;

	if (length !== check) {
		throw new Error('Error reading buffer');
	}

	// Deserialize the contents
	contents = bson.deserialize(contents);

	this._previous_hash = new Buffer(contents[0], 'hex');
	this._timestamp = contents[1];
	this._nonce = contents[2];
	this._transactions = contents[3];
	this._hash = hash;

	return this._buffer = file;
});

/**
 * Set this block as dirty
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Buffer}   buffer
 *
 * @return   {Develry.Chainful.Block}
 */
Block.setStatic(function fromBuffer(buffer) {

	var block = new Block();

	block.buffer = buffer;

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

	return value;
});

/**
 * Generate the bson representation of this block's contents
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Block.setMethod(function generateBsonContents() {

	var result,
	    data;

	data = [
		this.previous_hash.toString('hex'),
		this.timestamp,
		this.nonce,
		this.transactions
	];

	result = bson.serialize(data);

	return result;
});

/**
 * Calculate the hash and callback with a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Block.setMethod(function calculateHash(callback) {

	var input,
	    hash;

	input = this.bson_contents;

	// Hash everything
	hash = crypto.createHash('sha256').update(input).digest();

	// Maybe I'll make this asynchronous later,
	// so let's save future me a lot of work and implement callbacks now
	Blast.nextTick(callback, this, null, hash);
});

/**
 * Mine the block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 */
Block.setMethod(function mine(difficulty, callback) {

	var that = this,
	    expectations = Array(difficulty + 1).join('0');

	// Calculate the hash
	this.calculateHash(function gotHash(err, hash_buffer) {

		var reality,
		    hash;

		if (err) {
			return callback(err);
		}

		hash = hash_buffer.toString('hex');
		reality = hash.substring(0, difficulty);

		if (reality !== expectations) {
			that.nonce++;
			return Blast.nextTick(that.calculateHash, that, gotHash);
		}

		that._hash = hash_buffer;

		callback(null, hash, hash_buffer);
	});
});
