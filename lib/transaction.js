'use strict';

var Transaction,
    ChainfulNS,
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
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Chainful}   chainful
 */
Transaction = Fn.inherits('Informer', 'Develry.Chainful', function Transaction(chainful) {

	if (!chainful || !(chainful instanceof ChainfulNS.Chainful)) {
		throw new Error('Can not create transaction without Chainful instance link');
	}

	// Reference the the chain
	this.chainful = chainful;

});

/**
 * The data of this transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
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
	this._timestamp = null;
});

/**
 * Get the entire transaction as a buffer
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
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

	result = ChainfulNS.Chainful.serialize([
		this.owner,
		this.timestamp,
		this.packed_contents,
		this.signature
	]);

	this._buffer = result;
	return result;
}, function setBuffer(value) {

	var unpacked = ChainfulNS.Chainful.unserialize(value);

	// Set as the buffer
	this._buffer = value;

	// Set the owner
	this._owner = unpacked[0];

	// Set the timestamp
	this._timestamp = unpacked[1];

	// Set the packed contents
	this._packed_contents = unpacked[2];

	// And unpack those, too
	this._data = ChainfulNS.Chainful.unserialize(this._packed_contents)[0];

	// And finally the signature
	this._signature = unpacked[3];
});

/**
 * Get the binary contents that require signing
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.2.0
 *
 * @type     {Buffer}
 */
Transaction.setProperty(function packed_contents() {

	// Return the possibly existing buffer
	if (!this._packed_contents) {
		this._packed_contents = ChainfulNS.Chainful.serialize([this.data]);
	}

	return this._packed_contents;

}, function setPackedContents(value) {

	var parsed;

	// Parse the buffer
	parsed = ChainfulNS.Chainful.unserialize(value);

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
 * The timestamp of this transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type     {Number}
 */
Transaction.setProperty(function timestamp() {
	return this._timestamp;
}, function setTimestamp(value) {
	this._signature = null;
	this._signature_hex = null;
	this._buffer = null;
	return this._timestamp = Number(value);
});

/**
 * The age of this transaction as a timestamp
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type     {Number}
 */
Transaction.setProperty(function age() {
	return Date.now() - this.timestamp;
});

/**
 * If this transaction is considered "old" for this chain
 * Eventually all transactions become "old", this is just to see
 * if a transaction that didn't get into the chain should be dropped.
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type     {Number}
 */
Transaction.setProperty(function is_old() {

	// It's considered "old" if it's older than 24 hours
	if (this.age > 24 * 60 * 60 * 1000) {
		return true;
	}

	return false;
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
			keys.setPrivateKey(private_key_hex, 'hex');
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
	signature = this.chainful.signBuffer(packed, private_key_hex);

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

	if (!this.timestamp) {
		throw new Error('The transaction is missing its timestamp');
	}

	if (!this.owner) {
		throw new Error('Can not verify transaction: does not appear to have an owner');
	}

	return this.chainful.verifyBuffer(this.packed_contents, this.signature_hex, this.owner_hex);
});

/**
 * Is this our miner transaction?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}
 *
 * @return   {Boolean}
 */
Transaction.setMethod(function isOurMinerTransaction(block, public_key) {

	if (!block) {
		throw new Error('Can not check miner transaction without block');
	}

	if (!public_key || !public_key.length) {
		throw new Error('Can not check miner transaction without valid public key');
	}

	// The data needs to be the string "miner"
	if (this.data !== 'miner') {
		return false;
	}

	// The timestamp needs to be the same as the block's
	if (this.timestamp !== block.timestamp) {
		return false;
	}

	// The owner hash must match
	if (!this.owner.equals(public_key)) {
		return false;
	}

	return true;
});

/**
 * See if the current transaction is the same as the given transaction
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Transaction}   transaction
 *
 * @return   {Boolean}
 */
Transaction.setMethod(function equals(transaction) {

	if (!this.owner.equals(transaction.owner)) {
		return false;
	}

	if (!this.signature.equals(transaction.signature)) {
		return false;
	}

	return true;
});
