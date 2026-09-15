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
  // it gets a broker, so hand it ours before we announce we are ready
  _setup () {
    this.backend.broker = this.broker
    super._setup()
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
