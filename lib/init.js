var Chainful,
    Blast;

// Get an existing Protoblast instance,
// or create a new one
if (typeof __Protoblast != 'undefined') {
	Blast = __Protoblast;
} else {
	Blast = require('protoblast')(false);
}

// Get the Peerpin namespace
Chainful = Blast.Bound.Function.getNamespace('Develry.Chainful');

require('./chainful.js');
require('./transaction.js');
require('./block.js');
require('./blockchain.js');

// Export the Chainful namespace
module.exports = Blast.Classes.Develry.Chainful;