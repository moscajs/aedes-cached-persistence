# aedes-cached-persistence
![](https://github.com/moscajs/aedes-cached-persistence/workflows/ci.yml/badge.svg)
[![Dependencies Status](https://david-dm.org/moscajs/aedes-cached-persistence/status.svg)](https://david-dm.org/moscajs/aedes-cached-persistence)
[![devDependencies Status](https://david-dm.org/moscajs/aedes-cached-persistence/dev-status.svg)](https://david-dm.org/moscajs/aedes-cached-persistence?type=dev)
<br/>
[![Known Vulnerabilities](https://snyk.io/test/github/moscajs/aedes-cached-persistence/badge.svg)](https://snyk.io/test/github/moscajs/aedes-cached-persistence)
[![Coverage Status](https://coveralls.io/repos/moscajs/aedes-cached-persistence/badge.svg?branch=master&service=github)](https://coveralls.io/github/moscajs/aedes-cached-persistence?branch=master)
[![NPM version](https://img.shields.io/npm/v/aedes-cached-persistence.svg?style=flat)](https://www.npmjs.com/package/aedes-cached-persistence)
[![NPM downloads](https://img.shields.io/npm/dm/aedes-cached-persistence.svg?style=flat)](https://www.npmjs.com/package/aedes-cached-persistence)

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

### Tests

A persistence needs to pass all tests defined in
[./abstract.js](./abstract.js). You can import and use that test suite
in the following manner:

```js
var test = require('tape').test
var myperst = require('./')
var abs = require('aedes-cached-persistence/abstract')

abs({
  test: test,
  persistence: myperst
})
```

If you require some async stuff before returning, a callback is also
supported:

```js
var test = require('tape').test
var myperst = require('./')
var abs = require('aedes-persistence/abstract')
var clean = require('./clean') // invented module

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

[aedes]: http://npm.im/aedes
[aedes-persistence]: http://npm.im/aedes-persistence
