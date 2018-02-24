var assert = require('assert'),
    crypto = require('crypto'),
    genesis_block,
    target_buffer = new Buffer(0),
    mined_block,
    private_key,
    public_key,
    ChainfulNS,
    main_chain,
    Blast,
    ecdh;

ecdh = crypto.createECDH('secp256k1')
ecdh.generateKeys();

private_key = ecdh.getPrivateKey(null, 'compressed');
public_key = ecdh.getPublicKey(null, 'compressed');

describe('Chainful', function() {

	// There's lots of crypto work here, so it goes a bit slower than normal
	// Don't nag about it
	this.slow(2000);

	it('should load the namespace correctly', function() {

		var chain_from_ns,
		    chain;

		// Require via the main index.js
		ChainfulNS = require('../index.js');

		// The name of the namespace should be Chainful
		assert.equal(ChainfulNS.name, 'Chainful', 'Namespace name does not match');

		// The namespace should be a link to the main class
		chain_from_ns = new ChainfulNS();
		chain = new ChainfulNS.Chainful();

		// These 2 should have the same constructor
		assert.equal(chain_from_ns.constructor, chain.constructor, 'The namespace does not return the correct constructor');

		// See if the other classes are exported
		assert.equal(typeof ChainfulNS.Block, 'function');
		assert.equal(typeof ChainfulNS.Transaction, 'function');

		// Create a new chain
		main_chain = new ChainfulNS.Chainful();
	});

	describe('#createGenesisBlock', function() {

		it('should create the first block of a chain', function(done) {
			this.timeout(5000);

			main_chain.createGenesisBlock(function gotBlock(err, block) {

				if (err) {
					throw err;
				}

				genesis_block = block

				assert.equal(block.chain, main_chain, 'The genesis block is missing a link to the chain');
				assert.equal(block.index, 0, 'The genesis block should have index 0');
				assert.equal(block.parent, undefined, 'The genesis block should have no parent');
				assert.equal(typeof block.hash_string, 'string', 'The genesis block should have been mined and have a hash');
				assert.equal(block.transactions.length, 0, 'The genesis block should have no transactions');

				assert.equal(main_chain.chain.length, 0, 'The genesis block should be added to the chain manually');

				// Add the genesis block
				main_chain.addBlock(genesis_block);

				done();
			}).catch(function gotErr(err) {
				done();
			});
		});
	});

	describe('#addTransaction(data, private_key)', function() {

		var transaction;

		it('should queue a transaction', function() {
			// Add a transaction with your private key
			transaction = main_chain.addTransaction({
				string : 'Just a string',
				number : 4300,
				arr    : [{a:1, b: 2}]
			}, private_key);

			assert.equal(main_chain.pending_transactions[0], transaction, 'Transaction should be in the pending array');
		});

		it('should sign the transaction', function() {
			assert.equal(transaction.signature_hex.length > 10, true, 'Transaction should have a signature');
		});

		it('should be verifyable with the public key', function() {
			assert.equal(transaction.verify(), true, 'Failed to verify the transaction');
		});
	});

	describe('#minePendingTransactions()', function() {
		it('should mine the pending transactions into a new block', function(done) {

			main_chain.minePendingTransactions(function gotBlock(err, block) {

				if (err) {
					throw err;
				}

				mined_block = block;

				// Reference hash should check out
				assert.equal(block.parent_hash_string, genesis_block.hash_string, 'The new block has a wrong parent hash');

				// It should have index 1
				assert.equal(block.index, 1, 'Second mined block should have index 1');

				// Still need to add the block to the chain
				assert.equal(main_chain.chain.length, 1, 'The new block should not be part of the chain yet');

				// The pending transactions list should be empty
				assert.equal(main_chain.pending_transactions.length, 0, 'The pending transactions list should be empty');

				assert.equal(block.parent, genesis_block);

				main_chain.addBlock(block);

				done();

			}).catch(function gotError(err) {
				done();
			});
		});
	});

	describe('#isValid(callback)', function() {
		it('should verify all the blocks', function(done) {
			main_chain.isValid(function isValid(err, is_valid, last_index) {

				if (err) {
					throw err;
				}

				assert.equal(is_valid, true, 'The chain should be valid');
				assert.equal(last_index, 1, 'The last index should be 1, since there are only 2 blocks');
				done();
			}).catch(function gotErr(err) {
				done();
			});
		});
	});

	describe('#storeChain', function() {

		it('should store the chain as binary data', function(done) {

			var dummy_stream = {
				write: function(buffer) {
					target_buffer = Buffer.concat([target_buffer, buffer]);
				},
				end: function() {}
			}

			main_chain.storeChain(dummy_stream, function stored(err) {

				if (err) {
					throw err;
				}

				assert.equal(target_buffer.length > 10, true, 'The target buffer should not be empty');
				done();

			}).catch(function onErr(err) {
				done();
			});
		});
	});

	describe('#loadFileBuffer(buffer, callback)', function() {

		var new_chain;

		it('should load in a chain from an existing buffer', function(done) {

			new_chain = new ChainfulNS.Chainful();

			new_chain.loadFileBuffer(target_buffer, function loaded(err) {

				if (err) {
					throw err;
				}

				assert.equal(new_chain.chain.length, main_chain.chain.length);
				assert.equal(new_chain.chain[0].hash_string, main_chain.chain[0].hash_string);

				// The transaction data of the second block should match
				assert.deepEqual(new_chain.chain[1].transactions[0].data, main_chain.chain[1].transactions[0].data)

				done();
			});
		});

		it('should be verifyable', function(done) {
			new_chain.isValid(function isValid(err, is_valid, last_index) {

				if (err) {
					throw err;
				}

				assert.equal(is_valid, true, 'The chain should be valid');
				assert.equal(last_index, 1, 'The last index should be 1, since there are only 2 blocks');
				done();
			}).catch(function gotErr(err) {
				done();
			});
		});
	});
});

function genesisBlockTests(block) {

}