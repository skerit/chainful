'use strict';

var libpath = require('path'),
    assert  = require('assert'),
    crypto  = require('crypto'),
    tmp     = require('tmp'),
    fs      = require('fs'),
    genesis_block,
    target_buffer = new Buffer(0),
    mined_block,
    private_key,
    public_key,
    ChainfulNS,
    main_chain,
    temp_dir,
    Blast,
    ecdh;

ecdh = crypto.createECDH('secp256k1')
ecdh.generateKeys();

private_key = ecdh.getPrivateKey(null, 'compressed');
public_key = ecdh.getPublicKey(null, 'compressed');

// Make sure temporary files get cleaned up
tmp.setGracefulCleanup();

describe('Chainful', function() {

	// There's lots of crypto work here, so it goes a bit slower than normal
	// Don't nag about it
	this.slow(3000);

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

			main_chain.createGenesisBlock(private_key, public_key, function gotBlock(err, block) {

				if (err) {
					throw err;
				}

				genesis_block = block;

				assert.equal(block.chainful, main_chain, 'The genesis block is missing a link to the chain');
				assert.equal(block.index, 0, 'The genesis block should have index 0');
				assert.equal(block.parent, undefined, 'The genesis block should have no parent');
				assert.equal(typeof block.hash_string, 'string', 'The genesis block should have been mined and have a hash');

				assert.equal(main_chain.length, 0, 'The genesis block should be added to the chain manually');

				assert.equal(block.transactions[0].data, 'miner', 'The miner transaction should contain "miner" as data');
				assert.equal(block.transactions[0].timestamp, block.timestamp, 'The miner transaction should be the same as the block timestamp');

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

			main_chain.minePendingTransactions(private_key, public_key, function gotBlock(err, block) {

				if (err) {
					throw err;
				}

				mined_block = block;

				// Reference hash should check out
				assert.equal(block.parent_hash_string, genesis_block.hash_string, 'The new block has a wrong parent hash');

				// It should have index 1
				assert.equal(block.index, 1, 'Second mined block should have index 1');

				// Still need to add the block to the chain
				assert.equal(main_chain.length, 1, 'The new block should not be part of the chain yet');

				// The pending transactions list should be empty
				assert.equal(main_chain.pending_transactions.length, 0, 'The pending transactions list should be empty');

				assert.equal(block.parent, genesis_block);

				assert.equal(block.transactions[0].data, 'miner', 'The miner transaction should contain "miner" as data');
				assert.equal(block.transactions[0].timestamp, block.timestamp, 'The miner transaction should be the same as the block timestamp');

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
				end: function(callback) {
					callback();
				}
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

		it('should store the chain to a directory', function(done) {

			// Create a temporary directory
			// "unsafeCleanup" means "delete directory even if there are files in it"
			temp_dir = tmp.dirSync({unsafeCleanup: true});

			// Store the chain in that directory
			main_chain.storeChain(temp_dir.name, function stored(err) {

				var file_path,
				    stat;

				if (err) {
					throw err;
				}

				file_path = libpath.resolve(temp_dir.name, '000000.chainful');

				// The folder should contain the file
				assert.equal(fs.existsSync(file_path), true);

				// Get the stats object
				stat = fs.statSync(file_path);

				assert.ok(stat.size > 0, 'The stored chain is empty!');
				assert.ok(stat.size > 200, 'The stored chain is too small: ' + stat.size);

				done();
			}).catch(function onErr(err) {
				done();
			});
		});
	});

	describe('#loadFromBuffer(buffer, callback)', function() {

		var new_chain;

		it('should load in a chain from an existing buffer', function(done) {

			new_chain = new ChainfulNS.Chainful();

			new_chain.loadFromBuffer(target_buffer, function loaded(err) {

				if (err) {
					throw err;
				}

				assert.equal(new_chain.length, main_chain.chain.length);
				assert.equal(new_chain.getByIndex(0).hash_string, main_chain.getByIndex(0).hash_string);

				// The transaction data of the second block should match
				assert.deepEqual(new_chain.getByIndex(1).transactions[0].data, main_chain.getByIndex(1).transactions[0].data)

				// Get the first block
				let new_block = new_chain.getByIndex(0);

				assert.equal(new_block.transactions[0].data, 'miner', 'The miner transaction should contain "miner" as data');
				assert.equal(new_block.transactions[0].timestamp, new_block.timestamp, 'The miner transaction should be the same as the block timestamp');

				// Get the same block from the other chain
				let old_block = main_chain.getByIndex(0);

				// The 2 blocks should be the same
				assert.equal(old_block.equals(new_block), true);

				// Now get transactions
				let new_transaction = new_block.transactions[0],
				    old_transaction = old_block.transactions[0];

				assert.equal(old_transaction.equals(new_transaction), true);

				done();
			});
		});

		it('should have restored a valid chain', function(done) {
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

	describe('#loadChain(source_dir, callback)', function() {

		var new_chain;

		it('should load in a chain from a directory', function(done) {

			new_chain = new ChainfulNS.Chainful();

			new_chain.loadChain(temp_dir.name, function loaded(err) {

				if (err) {
					throw err;
				}

				assert.equal(new_chain.length, main_chain.length);
				assert.equal(new_chain.getByIndex(0).hash_string, main_chain.getByIndex(0).hash_string);

				// The transaction data of the second block should match
				assert.deepEqual(new_chain.getByIndex(1).transactions[0].data, main_chain.getByIndex(1).transactions[0].data)

				done();

			}).catch(function gotErr(err) {
				done();
			});
		});

		it('should have restored a valid chain', function(done) {
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

	// Create the communicating chains
	let chain_one,
	    chain_two,
	    private_key_one,
	    public_key_one,
	    private_key_two,
	    public_key_two;

	describe('#setBlockRequester(requester_function)', function() {
		it('should request blocks & add them', function(done) {

			this.timeout(20000);

			var ecdh = crypto.createECDH('secp256k1');

			// Generate some testkeys
			ecdh.generateKeys();

			// Get the keys for the first chain instance
			private_key_one = ecdh.getPrivateKey(null, 'compressed');
			public_key_one  = ecdh.getPublicKey(null, 'compressed');

			// Get the private keys for the second chain
			ecdh.generateKeys();
			private_key_two = ecdh.getPrivateKey(null, 'compressed');
			public_key_two  = ecdh.getPublicKey(null, 'compressed');

			chain_one = new ChainfulNS.Chainful();
			chain_two = new ChainfulNS.Chainful();

			// Create & hash the first block in the first chain
			chain_one.createGenesisBlock(private_key_one, private_key_two, function gotBlock(err, block) {

				if (err) {
					throw err;
				}

				// Add the block to the chain
				chain_one.addBlock(block);

				// Queue a new transaction and sign it with your private key
				let transaction = chain_one.addTransaction({
					name   : 'first_block_transaction',
					number : 4747,
					array  : [{a: 1}, {b: 2}]
				}, private_key_one);

				__Protoblast.Bound.Function.series(function mine(next) {
					// Mine a new block with the current pending transactions
					// (the one we just created)
					chain_one.minePendingTransactions(private_key_one, private_key_two, function done(err, _block) {

						if (err) {
							return next(err);
						}

						block = _block;

						// Again: add the mined block to the chain
						chain_one.addBlock(block);

						next();
					});
				}, function mineNext(next) {

					// Queue another transaction
					transaction = chain_one.addTransaction({test: 1}, private_key_one);

					// Mine it again
					chain_one.minePendingTransactions(private_key_one, private_key_two, function done(err, _block) {
						if (err) {
							return next(err);
						}

						block = _block;

						// Again: add the mined block to the chain
						chain_one.addBlock(block);

						next();
					});

				}, function checkValid(next) {
					chain_one.isValid(next);
				}, function startSecondChain(next) {

					var initial_test = true;

					// First we'll add some logic to actually request the data
					// Normally you would add some network logic here,
					// but for this example we'll just go steal the blocks from block_one
					//
					// The `getBlocks` function receives 3 parameters:
					//  - requested_blocks      : An array of indexes of blocks to get (can also be empty)
					//  - last_available_block  : The last available block in our chain, so newer once are also welcome
					//  - callback              : A callback where we can send the array response to
					chain_two.setBlockRequester(function getBlocks(requested_blocks, last_available_block, callback) {

						var new_block_buffers = [],
						    i;

						// No blocks? Get them all then
						if (!last_available_block) {
							i = 0;
						} else {
							i = last_available_block.index;
						}

						// Get the binary buffers from chain_one
						// As I said: you would probably add network logic here.
						// So: send a request to another network for the wanted blocks,
						// and then receive them over a Socket as binary data
						for (; i < chain_one.length; i++) {
							new_block_buffers.push(chain_one.getByIndex(i).buffer);
						}

						// Expect 3 buffers on the first test
						if (initial_test) {
							assert.equal(new_block_buffers.length, 3);
							initial_test = false;
						}

						callback(null, new_block_buffers);
					});

					chain_two.requestUpdate(function requested(err) {

						if (err) {
							return next(err);
						}

						// The second chain should now have 3 blocks
						assert.equal(chain_two.length, chain_one.length, 'Chains did not synchronize correctly');

						chain_two.isValid(function validated(err) {

							if (err) {
								return next(err);
							}

							next();
						});
					})

				}, function _done(err) {

					if (err) {
						throw err;
					}

					done();
				});

			});
		});
	});

	describe('#resolveConflicts(callback)', function() {
		it('should resolve forks', function(done) {

			var c1_block1,
			    c1_block2,
			    c2_block1;

			// First let's add some extra blocks to both chains
			__Protoblast.Bound.Function.series(function addChainOneBlock1(next) {

				chain_one.addTransaction({test: 'chain1extra1'}, private_key_one);

				chain_one.minePendingTransactions(private_key_one, public_key_one).then(function(block) {
					c1_block1 = block;
					chain_one.addBlock(c1_block1);
					next();
				}).catch(function(err) {
					next(err);
				});
			}, function addChainOneBlock2(next) {

				chain_one.addTransaction({test: 'chain1extra2'}, private_key_one);

				chain_one.minePendingTransactions(private_key_one, public_key_one).then(function(block) {
					c1_block2 = block;
					chain_one.addBlock(c1_block2);
					next();
				}).catch(function(err) {
					next(err);
				});
			}, function addChainTwoBlock1(next) {

				chain_two.addTransaction({test: 'chain2extra1'}, private_key_two);

				chain_two.minePendingTransactions(private_key_two, public_key_two).then(function(block) {
					c2_block1 = block;
					chain_two.addBlock(c2_block1);
					next();
				}).catch(function(err) {
					next(err);
				});
			}, function requestUpdate(next) {
				chain_two.requestUpdate().then(function updated(value) {

					assert.equal(chain_two.forks.length, 1, 'The second chain should have 1 fork by now');
					next();

				}).catch(function(err) {
					next(err);
				});
			}, function resolveConflicts(next) {
				chain_two.resolveConflicts(function resolved(err, switched) {

					if (err) {
						return next(err);
					}

					assert.equal(switched, true, 'Second chain should have switched to the fork');
					assert.equal(chain_two.length, chain_one.length);
					next();
				});
			}, function _done(err) {

				if (err) {
					throw err;
				}

				done();
			});

		});
	});
});