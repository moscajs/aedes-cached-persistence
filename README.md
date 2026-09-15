# aedes-cached-persistence
![](https://github.com/moscajs/aedes-cached-persistence/workflows/ci.yml/badge.svg)
<br/>
[![Known Vulnerabilities](https://snyk.io/test/github/moscajs/aedes-cached-persistence/badge.svg)](https://snyk.io/test/github/moscajs/aedes-cached-persistence)
[![Coverage Status](https://coveralls.io/repos/moscajs/aedes-cached-persistence/badge.svg?branch=master&service=github)](https://coveralls.io/github/moscajs/aedes-cached-persistence?branch=master)
[![NPM version](https://img.shields.io/npm/v/aedes-cached-persistence.svg?style=flat)](https://www.npmjs.com/package/aedes-cached-persistence)
[![NPM downloads](https://img.shields.io/npm/dm/aedes-cached-persistence.svg?style=flat)](https://www.npmjs.com/package/aedes-cached-persistence)

### This module has been superseded by [aedes-persistence](persistence)
---


Abstract class to write an [Aedes][aedes] [persistence][aedes-persistence] with in-process caching of subscriptions.
It implements the API defined by [aedes-persistence](persistence).

- [aedes-cached-persistence](#aedes-cached-persistence)
  - [Install](#install)
  - [Provided methods](#provided-methods)
  - [Implement another persistence](#implement-another-persistence)
    - [Inheritance](#inheritance)
    - [Tests](#tests)
  - [License](#license)

## Install

To install aedes-cached-persistence, simply use npm:

```sh
npm install aedes-cached-persistence --save
```

## Provided methods

* <a href="http://github.com/moscajs/aedes-persistence#constructor"><code><b>CachedPersistence()</b></code></a>
* <a href="http://github.com/moscajs/aedes-persistence#subscriptionsByTopic"><code>instance.<b>subscriptionsByTopic()</b></code></a>
* <a href="http://github.com/moscajs/aedes-persistence#cleanSubscriptions"><code>instance.<b>cleanSubscriptions()</b></code></a>
* <a href="http://github.com/moscajs/aedes-persistence#destroy"><code>instance.<b>destroy()</b></code></a>

## Implement another persistence

### Inheritance

In order to reuse aedes-cached-persistence, you need to:

```js
const CachedPersistence = require('aedes-cached-persistence')

// if you need http://npm.im/aedes-packet, it is available
// from this module as well
// const { Packet } = CachedPersistence

class MyPersistence extends CachedPersistence {
    constructor(opts) {
       super(opts)
    }
    addSubscriptions(client, subs, cb) {
        // ..persistence specific implementation..
        // call super._addedSubscriptions when you are done
        super._addedSubscriptions(client, subs.map(mapSub), cb)
    }
    removeSubscriptions(client, subs, cb) {
        // ..persistence specific implementation..
        // call super._removedSubscriptions when you are done
        super._removedSubscriptions(client, subs.map(mapSub), cb)
    }
}

function mapSub (sub) {
  return { topic: sub.topic }
}
```

Beside the subscription methods, an implementation has to provide every store
method of the [aedes-persistence][] API, including `cleanIncoming(client, cb)`,
added in aedes-persistence v11.

`cleanIncoming` must remove every stored incoming (QoS 2) packet of that client,
leave other clients' packets alone, and report no error when the client has
nothing stored. `abstract.js` asserts exactly that. A single delete-by-client
operation is cheaper than a loop over `incomingDelPacket()`, but either
satisfies the contract.

It has to accept both call forms, because aedes uses the promise one:

```js
cleanIncoming (client, cb) {
    if (!cb) {
        return new Promise((resolve, reject) => {
            this.cleanIncoming(client, err => {
                if (err) { reject(err) } else { resolve() }
            })
        })
    }
    // ..persistence specific implementation..
    cb(null, client)
}
```

`abstract.js` only exercises the callback form, so a callback-only
implementation passes the suite and then throws inside aedes on every
clean-session close and CONNECT. `CallBackPersistence` already handles both.

aedes feature-detects the method and skips it when a persistence does not have
it, so an implementation that omits it still runs. It is then vulnerable: the
QoS 2 dedup table survives a clean-session reconnect, and the first colliding
`messageId` the reconnected client publishes is acknowledged without ever being
delivered (GHSA-p8r9-qf8w-p73r). `CallBackPersistence` mirrors that detection -
when the async persistence it wraps has no `cleanIncoming`, and no subclass has
supplied one, it leaves its own `cleanIncoming` property `undefined` and emits a
process warning.

### Tests

A persistence needs to pass all tests defined in
[./abstract.js](./abstract.js). You can import and use that test suite
in the following manner:

```js
const test = require('node:test')
const myperst = require('./')
const abs = require('aedes-cached-persistence/abstract')

abs({
  test: test,
  persistence: myperst
})
```

If you require some async stuff before returning, a callback is also
supported:

```js
const test = require('node:test')
const myperst = require('./')
const abs = require('aedes-persistence/abstract')
const clean = require('./clean') // invented module

abs({
  test: test,
  buildEmitter: require('mymqemitter'), // optional
  persistence: function build (cb) {
    clean(function (err) {
      cb(err, myperst())
    })
  }
})
```

## License

MIT

[aedes]: http://npmjs.com/package/aedes
[aedes-persistence]: http://npmjs.com/package/aedes-persistence
