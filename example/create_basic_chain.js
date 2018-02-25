'use strict';

var Chainful = require('../index.js'),
    tmp_dir,
    crypto   = require('crypto'),
    chain    = new Chainful.Chainful(),
    ecdh     = crypto.createECDH('secp256k1');

if (process.argv[2]) {
	tmp_dir = process.argv[2];
} else {
	throw new Error('Please provide a directory to store the chain to');
}

// Generate some testkeys
ecdh.generateKeys();

// Get the keys
let private_key = ecdh.getPrivateKey(null, 'compressed'),
    public_key  = ecdh.getPublicKey(null, 'compressed'),
    start       = Date.now();

// The difficulty determines with how many zeroes the hash has to start
// A difficulty of 1 takes about 1-50 attempts (0.03 - 0.1 seconds)
// A difficulty of 2 takes about 3-700 attempts (0.1 - 0.3 seconds)
// A difficulty of 3 takes about 3500-7000 attempts (1 - 2 seconds)
// A difficulty of 4 takes about 27.000-230000 attempts (5 - 50 seconds)
// A difficulty of 5 takes about 560.000-1.560.000 attempts (120 - 267 seconds-

// The default is 2 and is also LOCKED in place, for now
chain.difficulty = 2;

// Create & hash the first block
chain.createGenesisBlock(private_key, public_key, async function gotBlock(err, block) {

	if (err) {
		return console.error('Failed to create genesis block:', err);
	}

	console.log('Created genesis block', block.index, 'in', (Date.now() - start) / 1000, 'seconds, requiring', block.nonce, 'attempts');
	console.log(' - Hash:', block.hash_string, '\n');

	// Add the block to the chain
	chain.addBlock(block);

	// Queue a new transaction and sign it with your private key
	let transaction = chain.addTransaction({
		name   : 'first_block_transaction',
		number : 4747,
		array  : [{a: 1}, {b: 2}]
	}, private_key);

	console.log('Created new transaction');
	console.log(' - Signature:', transaction.signature_hex, '\n');

	// Reset the start time
	start = Date.now();

	// Mine a new block with the current pending transactions
	// (the one we just created)
	block = await chain.minePendingTransactions(private_key, public_key);

	console.log('Created second block', block.index, 'in', (Date.now() - start) / 1000, 'seconds, requiring', block.nonce, 'attempts');
	console.log(' - Hash:', block.hash_string, '\n');

	// Again: add the mined block to the chain
	chain.addBlock(block);

	// Queue another transaction
	transaction = chain.addTransaction({test: 1}, private_key);

	console.log('Created new transaction');
	console.log(' - Signature:', transaction.signature_hex, '\n');

	// Reset the start time
	start = Date.now();

	// Mine it again
	block = await chain.minePendingTransactions(private_key, public_key);

	console.log('Created third block', block.index, 'in', (Date.now() - start) / 1000, 'seconds, requiring', block.nonce, 'attempts');
	console.log(' - Hash:', block.hash_string, '\n');

	// Add it again
	chain.addBlock(block);

	// Check if the chain is valid
	// (verify hashes & signatures)
	chain.isValid(function isValid(err, valid, last_index) {

		if (err) {
			return console.error('Failed to validate chain:', err);
		}

		console.log('Chain is valid, storing chain to directory...');

		// Store the chain as a binary file in a directory
		chain.storeChain(tmp_dir, function done(err) {

			if (err) {
				return console.error('Failed to store directory:', err);
			}

			console.log('Stored the chain as a binary file!');

			// Create a new chain
			let new_chain = new Chainful.Chainful();
			new_chain.difficulty = 2;

			// And load it from the binary file
			new_chain.loadChain(tmp_dir, function done(err) {

				if (err) {
					return console.error('Failed to load chain from directory:', err);
				}

				console.log('Loaded chain!');

			});
		});
	});
});