'use strict'
const CachedPersistence = require('../..')

class TestPersistence extends CachedPersistence {
  constructor (opts) {
    super(opts)
    this.backend = opts.backend

    // link methods
    const methods = ['storeRetained', 'countOffline', 'outgoingEnqueue',
      'outgoingUpdate', 'outgoingClearMessageId',
      'incomingStorePacket', 'incomingGetPacket',
      'incomingDelPacket', 'cleanIncoming', 'putWill', 'delWill',
      'createRetainedStream',
      'outgoingStream', 'subscriptionsByClient',
      'getWill', 'streamWill', 'getClientList', 'destroy']
    for (const key of methods) {
      this[key] = this.backend[key].bind(this.backend)
    }
  }

  // the backend is a persistence in its own right: it queues every call until
  // it gets a broker and its own setup is async, so hand it our broker and wait
  // for it before we announce that we are ready
  _setup () {
    if (this.ready) {
      return
    }
    this.backend.broker = this.broker
    if (this.backend.ready) {
      super._setup()
      return
    }
    this.backend.once('ready', () => super._setup())
    // without this the backend's setup failure would hang us instead
    this.backend.once('error', err => this.emit('error', err))
  }

  addSubscriptions (client, subs, cb) {
    this.backend.addSubscriptions(client, subs, (err) => {
      if (err) {
        return cb(err)
      }
      super._addedSubscriptions(client, subs, cb)
    })
  }

  removeSubscriptions (client, topics, cb) {
    this.backend.removeSubscriptions(client, topics, (err) => {
      if (err) {
        return cb(err)
      }
      const subsObjs = topics.map(function mapSub (topic) {
        return { topic }
      })
      super._removedSubscriptions(client, subsObjs, cb)
    })
  }
}

module.exports = { TestPersistence }
