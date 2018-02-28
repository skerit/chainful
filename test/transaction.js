'use strict';

var libpath = require('path'),
    assert  = require('assert'),
    crypto  = require('crypto'),
    tmp     = require('tmp'),
    fs      = require('fs'),
    genesis_block,
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

// Get the namespace
ChainfulNS = require('../index.js');

describe('Transaction', function() {

	before(function() {
		// Create a new chain
		main_chain = new ChainfulNS.Chainful();
	});

	describe('.constructor(chainful)', function() {
		it('should throw an error when the chainful parent is not given', function() {

			assert.throws(function() {
				new ChainfulNS.Transaction();
			});

			assert.throws(function() {
				new ChainfulNS.Transaction({something_else: 1});
			});
		});
	});

	describe('#packed_contents', function() {

		var transaction;

		before(function() {
			transaction = main_chain.createTransaction({
				test: 47
			});
		});

		it('should return the contents as a buffer', function() {
			var buffer = transaction.packed_contents,
			    new_transaction = new ChainfulNS.Transaction(main_chain);

			assert.equal(Buffer.isBuffer(buffer), true, 'A buffer is expected');

			// Set the buffer on the new transaction
			new_transaction.packed_contents = buffer;

			assert.equal(Buffer.isBuffer(new_transaction.packed_contents), true);
			assert.equal(new_transaction.data.test, 47);
		});
	});

	describe('#signature_hex', function() {
		it('should return undefined when there is no signature', function() {
			var new_transaction = new ChainfulNS.Transaction(main_chain);

			assert.equal(new_transaction.signature_hex, undefined);
		});
	});

	describe('#owner_hex', function() {
		it('should return undefined when there is no owner', function() {
			var new_transaction = new ChainfulNS.Transaction(main_chain);

			assert.equal(new_transaction.owner_hex, undefined);
		});
	});

	describe('#sign(private_key, public_key)', function() {
		var new_transaction;

		before(function() {
			new_transaction = main_chain.createTransaction({
				test: 48
			});
		});

		it('should throw an error when no private key is given', function() {
			assert.throws(function() {
				new_transaction.sign();
			});
		});

		it('should accept private key hex strings', function() {
			var new_transaction = main_chain.createTransaction({test: 48});
			new_transaction.sign(private_key.toString('hex'));

			assert.equal(Buffer.isBuffer(new_transaction.signature), true);
		});

		it('should accept public key hex strings', function() {
			var new_transaction = main_chain.createTransaction({test: 48});
			new_transaction.sign(private_key.toString('hex'), public_key.toString('hex'));

			assert.equal(Buffer.isBuffer(new_transaction.signature), true);
		});
	});

	describe('#is_old', function() {
		it('should return true for transactions over 24hours old', function() {
			// Create new transaction
			var new_transaction = main_chain.createTransaction({test: 48});

			// Override the timestamp for testing
			new_transaction.timestamp = 1;

			assert.equal(new_transaction.is_old, true);
		});
	});

	describe('#verify()', function() {
		it('should throw an error when it is missing a timestamp', function() {
			// Create new transaction
			var new_transaction = main_chain.createTransaction({test: 48});

			new_transaction.timestamp = null;

			assert.throws(function() {
				new_transaction.verify();
			});
		});

		it('should throw an error when it has no owner', function() {
			// Create new transaction
			var new_transaction = main_chain.createTransaction({test: 48});
			new_transaction.timestamp = 1;

			assert.throws(function() {
				new_transaction.verify();
			});
		});
	});

	describe('#isOurMinerTransaction(block, public_key)', function() {
		it('should throw an error when no block is given', function() {
			// Create new transaction
			var new_transaction = main_chain.createTransaction({test: 48});
			new_transaction.timestamp = 1;

			assert.throws(function() {
				new_transaction.isOurMinerTransactionBlock();
			});
		});

		it('should throw an error when no public key is given', function() {
			// Create new transaction
			var new_transaction = main_chain.createTransaction({test: 48});
			new_transaction.timestamp = 1;

			assert.throws(function() {
				new_transaction.isOurMinerTransactionBlock({});
			});
		});
	});
});