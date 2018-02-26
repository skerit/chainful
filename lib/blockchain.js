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
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Develry.Chainful.Chainful}   chainful
 * @param    {Develry.Chainful.Block}      parent
 */
Blockchain = Fn.inherits('Informer', 'Develry.Chainful', function Blockchain(chainful) {

	// Reference the the chainful instance
	this.chainful = chainful;

	// The actual array of blocks
	this.blocks = [];

	// Creation timestamp of the instance
	// (Useful for forks)
	this.timestamp = Date.now();

});

/**
 * The current length of this chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Blockchain.setProperty(function length() {
	return this.blocks.length + this.start_index;
});

/**
 * The current last block in the chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Blockchain.setProperty(function last_block() {

	var index = this.blocks.length - 1;

	// In this case we have to ADD the start_index,
	// because the index is based on the block array length
	if (this.start_index) {
		index = this.start_index + index;
	}

	if (index < 0) {
		return null;
	}

	return this.getByIndex(index);
});

/**
 * The current starting index of this chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Blockchain.setProperty(function start_index() {
	if (!this._start_index) {
		return 0;
	}

	return this._start_index;
}, function setStartIndex(value) {
	return this._start_index = value;
});

/**
 * See how much longer this chain is compared to another one.
 * If it isn't longer, false is returned
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Blockchain}   other_chain
 *
 * @return   {Number}
 */
Blockchain.setMethod(function isLongerThan(other_chain) {
	var longer_count = this.length - other_chain.length;

	if (longer_count <= 0) {
		return false;
	}

	return longer_count;
});

/**
 * Does this chain/fork contain the given block?
 * If this chain is a fork, it'll return false
 * in case the block is before this starting index
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}   block
 */
Blockchain.setMethod(function contains(block) {

	var temp;

	// Block is before the start index, so no!
	if (block.index < this.start_index) {
		return false;
	}

	temp = this.getByIndex(block.index);

	if (!temp) {
		return false;
	}

	return temp.equals(block);
});

/**
 * See if this is the target chain for the given block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}   block
 */
Blockchain.setMethod(function isTargetChainOf(block) {

	var parent,
	    temp;

	// Block is before the start index, so no!
	if (block.index < this.start_index) {
		return false;
	}

	temp = this.getByIndex(block.index);

	// The block is already part of this chain, so yes
	if (temp) {
		return true;
	}

	// See if it has this parent
	parent = this.getByIndex(block.index - 1);

	// Say no if the parent was not found
	if (!parent) {
		return false;
	}

	// If the parent is part of this chain the answer is yes
	return this.contains(parent);
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

	var adjusted_index = block.index - this.start_index;

	if (adjusted_index < 0) {
		throw new Error('Can not add older block to a fork');
	}

	this.blocks[adjusted_index] = block;
});

/**
 * Get a block by its full index
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Number}   index   The index of the block in the entire chain
 */
Blockchain.setMethod(function getByIndex(index) {

	var adjusted_index;

	if (index < 0) {
		throw new Error('Requested negative block index ' + index)
	}

	adjusted_index = index - this.start_index;

	// If the index is under 0, we're probably looking
	// for an index in a fork and it wants an older block
	if (adjusted_index < 0) {
		return this.chainful.getByIndex(index);
	}

	return this.blocks[adjusted_index];
});

/**
 * Make the blocks of this fork part of the main chain
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Blockchain.setMethod(function overwriteMainChain() {

	var block,
	    i;

	if (this.chainful.chain === this) {
		throw new Error('Can not move the blocks of the main chain into itself');
	}

	// If this already is the same chain, do nothing
	if (this.chainful.last_block && this.chainful.last_block.equals(this.last_block)) {
		return false;
	}

	// Trim the length of the current main block
	this.chainful.chain.blocks.length = this.length;

	// Replace blocks from where this fork changed
	for (i = this.start_index; i < this.length; i++) {
		// Get the current old block
		block = this.chainful.chain.getByIndex(i);

		// Add the block from this fork to the main chain
		this.chainful.chain.add(this.getByIndex(i));

		// If there was a block there, release the transactions now
		if (block) {
			block.releaseTransactions();
		}
	}

	// Remove this from the forks array
	i = this.chainful.forks.indexOf(this);

	if (i > -1) {
		this.chainful.forks.splice(i, 1);
	}

	return true;
});

/**
 * See if the chain is valid
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
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
 * Verify a proposed block
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Block}     block
 * @param    {Function}  callback
 */
Blockchain.setMethod(function verifyProposedBlock(block, callback) {

	var that = this;

	Fn.series(function verifySignatures(next) {

		var original_hash;

		// Accept blocks we already have in this case, it's probably for a fork
		if (that.last_block && that.last_block.equals(block)) {
			// Allow it
		} else {

			// Simple things first: the timestamp should be bigger
			if (block.index && block.timestamp <= that.last_block.timestamp) {
				return next(new Error('The proposed block has an older timestamp than the current last block'));
			}

			// The timestamp should also not be in the future
			if (block.timestamp > Date.now()) {
				return next(new Error('The proposed block has a timestamp in the future'));
			}

			// Now more expensive stuff: make sure the transactions are signed correctly
			if (!block.verifyTransactions()) {
				return next(new Error('The block contains invalidly signed transactions'));
			}
		}

		original_hash = block.hash;

		// Now see if the hash matches
		block.calculateHash(function gotHash(err, hash) {

			var i;

			if (err) {
				return next(err);
			}

			if (!original_hash.equals(hash)) {
				return next(new Error('The block hash is wrong'));
			}

			// Check the difficulty
			for (i = 0; i < that.chainful.difficulty; i += 2) {
				// As soon as one of the bytes is not 0, it's wrong
				if (hash[i/2] !== 0) {
					return next(new Error('The block hash does not match the difficulty'));
				}
			}

			next();
		});

	}, function doVerifierFunction(next) {

		// If this chain has a custom verifier,
		// execute that now
		if (that.chainful.verifier_function) {
			that.chainful.verifier_function(block, next);
		} else {
			next();
		}
	}, function done(err) {

		if (err) {
			return callback(err);
		}

		callback(null, true);
	});
});
