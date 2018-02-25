var Chainful = require('../index.js'),
    crypto   = require('crypto'),
    ecdh     = crypto.createECDH('secp256k1');

// Generate some testkeys
ecdh.generateKeys();

// Get the keys for the first chain instance
let private_key_one = ecdh.getPrivateKey(null, 'compressed'),
    public_key_one  = ecdh.getPublicKey(null, 'compressed');

// Get the private keys for the second chain
ecdh.generateKeys();
let private_key_two = ecdh.getPrivateKey(null, 'compressed'),
    public_key_two  = ecdh.getPublicKey(null, 'compressed');

// Create the chains
let chain_one = new Chainful.Chainful();
let chain_two = new Chainful.Chainful();

// Create & hash the first block in the first chain
chain_one.createGenesisBlock(async function gotBlock(err, block) {

	if (err) {
		return console.error('Failed to create genesis block:', err);
	}

	console.log('Created genesis block', block.index);
	console.log(' - Hash:', block.hash_string.slice(0, 16), '\n');

	// Add the block to the chain
	chain_one.addBlock(block);

	// Queue a new transaction and sign it with your private key
	let transaction = chain_one.addTransaction({
		name   : 'first_block_transaction',
		number : 4747,
		array  : [{a: 1}, {b: 2}]
	}, private_key_one);

	console.log('Created new transaction');
	console.log(' - Signature:', transaction.signature_hex.slice(0, 16), '\n');

	// Mine a new block with the current pending transactions
	// (the one we just created)
	block = await chain_one.minePendingTransactions();

	console.log('Created second block', block.index);
	console.log(' - Hash:', block.hash_string.slice(0, 16), '\n');

	// Again: add the mined block to the chain
	chain_one.addBlock(block);

	// Queue another transaction
	transaction = chain_one.addTransaction({test: 1}, private_key_one);

	console.log('Created new transaction');
	console.log(' - Signature:', transaction.signature_hex.slice(0, 16), '\n');

	// Mine it again
	block = await chain_one.minePendingTransactions();

	console.log('Created third block', block.index);
	console.log(' - Hash:', block.hash_string.slice(0, 16), '\n');

	// Add it again
	chain_one.addBlock(block);

	// Check if the chain is valid
	// (verify hashes & signatures)
	let is_valid = await chain_one.isValid();

	console.log('Original chain is valid, let\'s start the second one\n');

	await startSecondChain();
});

// This is the function that will run once the first chain has been set up
async function startSecondChain() {

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

		console.log('Requesting new blocks starting with index:', i, '...');

		// Get the binary buffers from chain_one
		// As I said: you would probably add network logic here.
		// So: send a request to another network for the wanted blocks,
		// and then receive them over a Socket as binary data
		for (; i < chain_one.chain.length; i++) {
			new_block_buffers.push(chain_one.chain[i].buffer);
		}

		console.log('   » Found', new_block_buffers.length, 'new blocks for the second chain\n');

		callback(null, new_block_buffers);
	});

	// Do a manual request for blocks
	await chain_two.requestBlocks();

	console.log('Chain two has requested and received all missing blocks');

	await chain_two.isValid();

	console.log('Chain two is valid!')
}