var Chainful = require('../index.js'),
    crypto   = require('crypto'),
    chain    = new Chainful.Chainful(),
    ecdh     = crypto.createECDH('secp256k1');

// Generate some testkeys
ecdh.generateKeys();

// Get the keys
let private_key = ecdh.getPrivateKey(null, 'compressed'),
    public_key  = ecdh.getPublicKey(null, 'compressed');

// Create & hash the first block
chain.createGenesisBlock(async function gotBlock(err, block) {

	if (err) {
		return console.error('Failed to create genesis block:', err);
	}

	console.log('Created genesis block', block.index);
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

	// Mine a new block with the current pending transactions
	// (the one we just created)
	block = await chain.minePendingTransactions();

	console.log('Created second block', block.index);
	console.log(' - Hash:', block.hash_string, '\n');

	// Again: add the mined block to the chain
	chain.addBlock(block);

	// Queue another transaction
	transaction = chain.addTransaction({test: 1}, private_key);

	console.log('Created new transaction');
	console.log(' - Signature:', transaction.signature_hex, '\n');

	// Mine it again
	block = await chain.minePendingTransactions();

	console.log('Created third block', block.index);
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
		chain.storeChain('/tmp/path/to/directory', function done(err) {

			if (err) {
				return console.error('Failed to store directory:', err);
			}

			console.log('Stored the chain as a binary file!');

			// Create a new chain
			let new_chain = new Chainful.Chainful();

			// And load it from the binary file
			new_chain.loadChain('/tmp/path/to/directory', function done(err) {

				if (err) {
					return console.error('Failed to load chain from directory:', err);
				}

				console.log('Loaded chain!');

			});
		});
	});
});