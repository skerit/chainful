var ChainfulNS,
    msgpack  = require('msgpack'),
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
 * @version  0.1.0
 *
 * @param    {Develry.Chainful.Chainful}   chain
 * @param    {Develry.Chainful.Block}      parent
 */
Block = Fn.inherits('Informer', 'Develry.Chainful', function Block(chain, parent) {

	// Reference the the chain
	this.chain = chain;

	// Reference to the parent block
	this.parent = parent;
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
 * @version  0.1.0
 *
 * @type     {String}
 */
Block.setProperty(function hash_string() {

	if (!this._hash_string) {
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
	throw new Error('Unable to set block by buffer');
});

/**
 * Revive a block from a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Buffer}                      buffer
 * @param    {Develry.Chainful.Chainful}   chain
 * @param    {Develry.Chainful.Block}      parent
 * @param    {Function}                    callback
 *
 * @return   {Develry.Chainful.Block}
 */
Block.setStatic(function fromBuffer(buffer, chain, parent, callback) {

	var block = new Block(chain, parent);

	block.setBuffer(buffer, callback);

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
 * Set the contents of this block from a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
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
		contents = msgpack.unpack(contents);

		that._index = contents[0];
		that._parent_hash = contents[1];
		that._timestamp = contents[2];
		that._nonce = contents[3];
		that._transactions = contents[4];
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
 * @version  0.1.0
 *
 * @param    {Function}   callback
 */
Block.setMethod(function getPackedContents(callback) {

	var result,
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
		this.transactions
	];

	result = msgpack.pack(data);

	this._dirty = false;
	this._binary_contents = null;

	// Deflate the contents
	zlib.deflateRaw(result, callback);
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

	zlib.inflateRaw(contents, function decompressed(err, result) {

		if (err) {
			return callback(err);
		}

		that._binary_contents = result;

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
 * @version  0.1.0
 *
 * @param    {Number}     difficulty
 * @param    {Function}   callback
 *
 * @return   {Pledge}   A pledge promise
 */
Block.setMethod(function mine(difficulty, callback) {

	var that = this,
	    expectations = Array(difficulty + 1).join('0'),
	    pledge = new Blast.Classes.Pledge();

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
