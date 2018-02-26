## 0.1.1 (WIP)

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
* Added support for forks

## 0.1.0 (2018-02-24)

* Initial release