'use strict'

var Qlobber = require('qlobber').Qlobber
var Packet = require('aedes-packet')
var EE = require('events').EventEmitter
var inherits = require('util').inherits
var fastparallel = require('fastparallel')
var MultiStream = require('multistream')

var QlobberOpts = {
  wildcard_one: '+',
  wildcard_some: '#',
  separator: '/'
}
var newSubTopic = '$SYS/sub/add'
var rmSubTopic = '$SYS/sub/rm'
var subTopic = '$SYS/sub/+'

function CachedPersistence (opts) {
  if (!(this instanceof CachedPersistence)) {
    return new CachedPersistence(opts)
  }

  EE.call(this)

  this.ready = false
  this.destroyed = false
  this._matcher = new Qlobber(QlobberOpts)
  this._waiting = {}
  this._parallel = fastparallel({ results: false })

  var that = this

  this.once('ready', function () {
    that.ready = true
  })

  this._onMessage = function onSubMessage (packet, cb) {
    var decoded = JSON.parse(packet.payload)
    var clientId
    for (var i = 0; i < decoded.subs.length; i++) {
      var sub = decoded.subs[i]
      clientId = sub.clientId
      if (packet.topic === newSubTopic) {
        if (!checkSubsForClient(sub, that._matcher.match(sub.topic))) {
          that._matcher.add(sub.topic, sub)
        }
      } else if (packet.topic === rmSubTopic) {
        that._matcher
          .match(sub.topic)
          .filter(matching, sub)
          .forEach(rmSub, that._matcher)
      }
    }
    var waiting = that._waiting[clientId]
    delete that._waiting[clientId]
    if (waiting) {
      process.nextTick(waiting)
    }
    cb()
  }
}

function matching (sub) {
  return sub.topic === this.topic && sub.clientId === this.clientId
}

function rmSub (sub) {
  this.remove(sub.topic, sub)
}

inherits(CachedPersistence, EE)

CachedPersistence.prototype._waitFor = function (client, cb) {
  this._waiting[client.id] = cb
}

CachedPersistence.prototype._addedSubscriptions = function (client, subs, cb) {
  if (!this.ready) {
    this.once('ready', this._addedSubscriptions.bind(this, client, subs, cb))
    return
  }

  subs = subs.filter(qosGreaterThanOne)

  var ctx = {
    cb: cb || noop,
    client: client,
    broker: this._broker,
    topic: newSubTopic,
    brokerPublish: brokerPublish
  }
  ctx.brokerPublish(subs, addedSubDone.bind(ctx))
}

function qosGreaterThanOne (sub) {
  return sub.qos > 0
}

function brokerPublish (subs, cb) {
  var encoded = JSON.stringify({subs: subs})
  var packet = new Packet({
    topic: this.topic,
    payload: encoded
  })
  this.broker.publish(packet, cb)
}

function addedSubDone () {
  this.cb(null, this.client)
}

function noop () {}

CachedPersistence.prototype._removedSubscriptions = function (client, subs, cb) {
  var ctx = {
    cb: cb || noop,
    client: client,
    broker: this._broker,
    topic: rmSubTopic,
    brokerPublish: brokerPublish
  }
  ctx.brokerPublish(subs, addedSubDone.bind(ctx))
}

CachedPersistence.prototype.subscriptionsByTopic = function (topic, cb) {
  if (!this.ready) {
    this.once('ready', this.subscriptionsByTopic.bind(this, topic, cb))
    return this
  }

  cb(null, this._matcher.match(topic))
}

CachedPersistence.prototype.cleanSubscriptions = function (client, cb) {
  var that = this
  this.subscriptionsByClient(client, function (err, subs, client) {
    if (err || !subs) { return cb(err, client) }
    subs = subs.map(subToTopic)
    that.removeSubscriptions(client, subs, cb)
  })
}

CachedPersistence.prototype.createRetainedStreamCombi = function (patterns) {
  var that = this
  var streams = patterns.map(function (p) {
    return that.createRetainedStream(p)
  })
  return MultiStream.obj(streams)
}

CachedPersistence.prototype.destroy = function (cb) {
  this.destroyed = true
  this.broker.unsubscribe(subTopic, this._onMessage, function () {
    if (cb) {
      cb()
    }
  })
}

// must emit 'ready'
CachedPersistence.prototype._setup = function () {
  this.emit('ready')
}

function subToTopic (sub) {
  return sub.topic
}

Object.defineProperty(CachedPersistence.prototype, 'broker', {
  enumerable: false,
  get: function () {
    return this._broker
  },
  set: function (broker) {
    this._broker = broker
    this.broker.subscribe(subTopic, this._onMessage, this._setup.bind(this))
  }
})

function checkSubsForClient (sub, savedSubs) {
  for (var i = 0; i < savedSubs.length; i++) {
    if (sub.topic === savedSubs[i].topic && sub.clientId === savedSubs[i].clientId) {
      return true
    }
  }
  return false
}

module.exports = CachedPersistence
module.exports.Packet = Packet
