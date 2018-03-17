## 0.2.2 (2018-03-17)

* Forked `msgpack-js` to fix trailing byte error throwing 

## 0.2.1 (2018-03-11)

* Switched from `msgpack` to `msgpack-js`
* Emit `added_block` or `added_fork_block` when a new block is added to the chain

## 0.2.0 (2018-02-28)

* Remove `elliptic` dependency, decompressing a public key can be done using `crypto`
* Add support for requesting & receiving new blocks
* The first transaction in a block indicates who mined it
* Add `Transaction#equals(transaction)`
* Add `Block#contains(transaction)`
* Add `Block#releaseTransactions()`
* Add `Transaction#timestamp`
* Add `Transaction#is_old` which will be true if the transaction is older than 1 day
* Transactions older than 1 day will be discarded
* Mining an empty block will throw an error
* Added a `Blockchain` class which will hold blocks instead of a regular array
* Added support for forks & fork resolving

## 0.1.0 (2018-02-24)

* Initial release