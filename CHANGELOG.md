## 0.1.1 (WIP)

* Remove `elliptic` dependency, decompressing a public key can be done using `crypto`
* Add support for requesting & receiving new blocks
* The first transaction in a block indicates who mined it
* Add `Transaction#equals(transaction)`
* Add `Block#contains(transaction)`
* Add `Block#releaseTransactions`

## 0.1.0 (2018-02-24)

* Initial release