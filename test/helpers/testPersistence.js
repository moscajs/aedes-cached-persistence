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
      'incomingDelPacket', 'delWill',
      'createRetainedStream',
      'outgoingStream', 'subscriptionsByClient',
      'getWill', 'streamWill', 'getClientList', 'destroy']
    for (const key of methods) {
      this[key] = this.backend[key].bind(this.backend)
    }

    // putWill is a special because it needs this.broker.id
    this.putWill = (client, packet, cb) => {
      this.backend.broker = this.broker
      this.backend.putWill(client, packet, cb)
    }
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
