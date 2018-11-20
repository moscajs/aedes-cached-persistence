'use strict'

var test = require('tape').test
var CachedPersistence = require('./')
var util = require('util')
var Memory = require('aedes-persistence')
var abs = require('./abstract')

function MyPersistence () {
  if (!(this instanceof MyPersistence)) {
    return new MyPersistence()
  }

  // copied from Memory
  this._retained = []
  this._subscriptions = new Map()
  this._clientsCount = 0
  this._outgoing = {}
  this._incoming = {}
  this._wills = {}

  CachedPersistence.call(this)
}

util.inherits(MyPersistence, CachedPersistence)

// copy over methods
;['storeRetained', 'countOffline', 'outgoingEnqueue',
  'outgoingUpdate', 'outgoingClearMessageId',
  'incomingStorePacket', 'incomingGetPacket',
  'incomingDelPacket', 'putWill', 'delWill',
  'createRetainedStream',
  'outgoingStream', 'subscriptionsByClient',
  'getWill', 'streamWill', 'getClientList', 'destroy'].forEach(function (key) {
  MyPersistence.prototype[key] = Memory.prototype[key]
})

MyPersistence.prototype.addSubscriptions = function (client, subs, cb) {
  var stored = this._subscriptions.get(client.id)

  if (!stored) {
    stored = new Map()
    this._subscriptions.set(client.id, stored)
    this._clientsCount++
  }

  var subsObjs = subs.map(function mapSub (sub) {
    stored.set(sub.topic, sub.qos)
    return {
      clientId: client.id,
      topic: sub.topic,
      qos: sub.qos
    }
  })

  this._addedSubscriptions(client, subsObjs, cb)
}

MyPersistence.prototype.removeSubscriptions = function (client, subs, cb) {
  var stored = this._subscriptions.get(client.id)
  var removed = []

  if (stored) {
    for (var i = 0; i < subs.length; i += 1) {
      var topic = subs[i]
      var qos = stored.get(topic)
      if (qos !== undefined) {
        if (qos > 0) {
          removed.push({
            clientId: client.id,
            topic: topic,
            qos: qos
          })
        }
        stored.delete(topic)
      }
    }

    if (stored.size === 0) {
      this._clientsCount--
      this._subscriptions.delete(client.id)
    }
  }

  this._removedSubscriptions(client, removed, cb)
}

abs({
  test: test,
  persistence: MyPersistence
})
