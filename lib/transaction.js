var Transaction,
    ChainfulNS,
    msgpack  = require('msgpack'),
    crypto   = require('crypto'),
    Blast    = __Protoblast,
    zlib     = require('zlib'),
    fs       = require('fs'),
    Fn       = Blast.Bound.Function;

// Get the namespace
ChainfulNS = Fn.getNamespace('Develry.Chainful');

/**
 * A transaction
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Develry.Chainful.Chainful}   chain
 */
Transaction = Fn.inherits('Informer', 'Develry.Chainful', function Transaction(chain) {

	// Reference the the chain
	this.chain = chain;

});

/**
 * The data of this transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Mixed}
 */
Transaction.setProperty(function data() {
	return this._data;
}, function setData(value) {
	this._data = value;
	this._buffer = null;
	this._packed_contents = null;
	this._signature = null;
	this._owner = null;
});

/**
 * Get the entire transaction as a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function buffer() {

	var result;

	if (this._buffer) {
		return this._buffer;
	}

	if (!this.signature) {
		throw new Error('Can not get buffer of an unsigned transaction');
	}

	result = msgpack.pack([
		this.owner,
		this.packed_contents,
		this.signature
	]);

	this._buffer = result;
	return result;
}, function setBuffer(value) {

	var unpacked = msgpack.unpack(value);

	// Set as the buffer
	this._buffer = value;

	// Set the owner
	this._owner = unpacked[0];

	// Set the packed contents
	this._packed_contents = unpacked[1];

	// And unpack those, too
	this._data = msgpack.unpack(this._packed_contents)[0];

	// And finally the signature
	this._signature = unpacked[2];
});

/**
 * Get the binary contents that require signing
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function packed_contents() {

	// Return the possibly existing buffer
	if (!this._packed_contents) {
		this._packed_contents = msgpack.pack([this.data]);
	}

	return this._packed_contents;

}, function setPackedContents(value) {

	var parsed;

	// Parse the buffer
	parsed = msgpack.unpack(value);

	// The first entry is the data
	this.data = parsed[0];

	this._buffer = null;
	this._packed_contents = value;
});

/**
 * The signature of this transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function signature() {
	return this._signature;
});

/**
 * The signature of this transaction as hex
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function signature_hex() {

	if (!this._signature) {
		return;
	}

	if (!this._signature_hex) {
		this._signature_hex = this._signature.toString('hex');
	}

	return this._signature_hex;
});

/**
 * The owner of this transaction (as buffer)
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function owner() {
	return this._owner;
});

/**
 * The owner of this transaction (as hex)
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function owner_hex() {

	if (!this._owner) {
		return;
	}

	if (!this._owner_hex) {
		this._owner_hex = this._owner.toString('hex');
	}

	return this._owner_hex;
});

/**
 * Sign this transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Buffer}   private_key
 * @param    {Buffer}   public_key
 */
Transaction.setMethod(function sign(private_key, public_key) {

	var private_key_hex,
	    public_key_hex,
	    signature,
	    packed,
	    keys;

	if (!private_key) {
		throw new Error('Can not sign a transaction without a private key');
	}

	if (typeof private_key == 'string') {
		private_key_hex = private_key;
		private_key = null;
	} else {
		private_key_hex = private_key.toString('hex');
	}

	if (!public_key) {
		keys = crypto.createECDH('secp256k1');

		if (private_key) {
			keys.setPrivateKey(private_key);
		} else {
			keys.setPrivateKey(private_key, 'hex');
		}

		public_key = keys.getPublicKey(null, 'compressed');
	}

	if (typeof public_key == 'string') {
		public_key_hex = public_key;
		public_key = new Buffer(public_key_hex, 'hex');
	} else {
		public_key_hex = public_key.toString('hex');
	}

	// Pack the data
	packed = this.packed_contents;

	// Generate the signature using the private key
	signature = this.chain.signBuffer(packed, private_key_hex);

	// Store the signature
	this._signature_hex = signature;
	this._signature = new Buffer(signature, 'hex');

	// Store the owner
	this._owner_hex = public_key_hex;
	this._owner = public_key;
});

/**
 * Verify this transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @return   {Boolean}
 */
Transaction.setMethod(function verify() {

	if (!this.owner) {
		throw new Error('Can not verify transaction: does not appear to have an owner');
	}

	return this.chain.verifyBuffer(this.packed_contents, this.signature_hex, this.owner_hex);
});