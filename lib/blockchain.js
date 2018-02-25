'use strict';

var ChainfulNS,
    Blockchain,
    Blast    = __Protoblast,
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
 * @since    0.1.1
 * @version  0.1.1
 *
 * @param    {Develry.Chainful.Chainful}   chainful
 * @param    {Develry.Chainful.Block}      parent
 */
Blockchain = Fn.inherits('Informer', 'Develry.Chainful', function Blockchain(chainful) {

	// Reference the the chainful instance
	this.chainful = chainful;

	// The actual array of blocks
	this.blocks = [];

	// The start index of this chain
	this.start_index = 0;

});

/**
 * The current length of this chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.1
 * @version  0.1.1
 */
Blockchain.setProperty(function length() {
	return this.blocks.length + this.start_index;
});

/**
 * The current last block in the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.1
 * @version  0.1.1
 */
Blockchain.setProperty(function last_block() {
	return this.blocks[this.blocks.length - 1];
});

/**
 * See if the chain is valid
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.1
 * @version  0.1.1
 *
 * @param    {Function}   callback   An old style callback that also gets the index on error
 *
 * @return   {Pledge}     A pledge promise
 */
Blockchain.setMethod(function isValid(callback) {

	var that = this,
	    last_index,
	    previous,
	    pledge = new Blast.Classes.Pledge();

	Fn.forEach(this.blocks, function checkBlock(block, index, next) {

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
 * Add a block by its index
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.0
 * @version  0.1.0
 *
 * @param    {Block}   block
 */
Blockchain.setMethod(function add(block) {
	this.blocks[block.index] = block;
});

/**
 * Get a block by its index
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.1.1
 * @version  0.1.1
 *
 * @param    {Number}   index
 */
Blockchain.setMethod(function getByIndex(index) {
	return this.blocks[index];
});