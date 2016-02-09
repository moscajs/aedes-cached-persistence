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
  this._subscriptions = []
  this._subscriptionsCount = 0
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
  'createRetainedStream', 'outgoingStream',
  'subscriptionsByClient',
  'getWill', 'streamWill', 'destroy'].forEach(function (key) {
    MyPersistence.prototype[key] = Memory.prototype[key]
  })

MyPersistence.prototype.addSubscriptions = function (client, subs, cb) {
  var that = this
  var stored = this._subscriptions[client.id]

  if (!stored) {
    stored = []
    this._subscriptions[client.id] = stored
    this._clientsCount++
  }

  var subsObjs = subs.map(function mapSub (sub) {
    return {
      clientId: client.id,
      topic: sub.topic,
      qos: sub.qos
    }
  })

  subsObjs.forEach(function eachSub (sub) {
    stored.push(sub)

    if (sub.qos > 0) {
      that._subscriptionsCount++
    }
  })

  this._addedSubscriptions(client, subsObjs, cb)
}

MyPersistence.prototype.removeSubscriptions = function (client, subs, cb) {
  var that = this
  var stored = this._subscriptions[client.id]
  var removed = []

  if (!stored) {
    stored = []
    this._subscriptions[client.id] = stored
  }

  this._subscriptions[client.id] = stored.filter(function noSub (storedSub) {
    var toKeep = subs.indexOf(storedSub.topic) < 0
    if (!toKeep) {
      that._subscriptionsCount--
      removed.push({
        clientId: client.id,
        topic: storedSub.topic,
        qos: storedSub.qos
      })
    }
    return toKeep
  })

  if (this._subscriptions[client.id].length === 0) {
    this._clientsCount--
    delete this._subscriptions[client.id]
  }

  this._removedSubscriptions(client, removed, cb)
}

abs({
  test: test,
  persistence: MyPersistence
})
