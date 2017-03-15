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
  'getWill', 'streamWill', 'getClientList', 'destroy'].forEach(function (key) {
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
    if (sub.qos > 0) {
      if (!checkSubsForClient(sub, that._matcher.match(sub.topic))) {
        that._subscriptionsCount++
        that._matcher.add(sub.topic, sub)
        stored.push(sub)
      }
    } else {
      if (!checkSubsForClient(sub, that._subscriptions[client.id])) {
        stored.push(sub)
      }
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

function checkSubsForClient (sub, savedSubs) {
  for (var i = 0; i < savedSubs.length; i++) {
    if (sub.topic === savedSubs[i].topic && sub.clientId === savedSubs[i].clientId) {
      return true
    }
  }
  return false
}

abs({
  test: test,
  persistence: MyPersistence
})
