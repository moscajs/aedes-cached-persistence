'use strict'

var Qlobber = require('qlobber').Qlobber
var Packet = require('aedes-packet')
var EE = require('events').EventEmitter
var inherits = require('util').inherits
var fastparallel = require('fastparallel')

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
    if (packet.topic === newSubTopic) {
      that._matcher.add(decoded.topic, decoded)
    } else if (packet.topic === rmSubTopic) {
      that._matcher
        .match(decoded.topic)
        .filter(matching, decoded)
        .forEach(rmSub, that._matcher)
    }
    var key = decoded.clientId + '-' + decoded.topic
    var waiting = that._waiting[key]
    delete that._waiting[key]
    if (waiting) {
      process.nextTick(waiting)
    }
    cb()
  }
}

function matching (sub) {
  return sub.topic === this.topic
}

function rmSub (sub) {
  this.remove(sub.topic, sub)
}

function Sub (clientId, topic, qos) {
  this.clientId = clientId
  this.topic = topic
  this.qos = qos
}

inherits(CachedPersistence, EE)

CachedPersistence.prototype._waitFor = function (client, topic, cb) {
  this._waiting[client.id + '-' + topic] = cb
}

CachedPersistence.prototype._addedSubscriptions = function (client, subs, cb) {
  if (!this.ready) {
    this.once('ready', this._addedSubscriptions.bind(this, client, subs, cb))
    return
  }

  subs = subs.filter(qosGreaterThanOne)

  this._parallel({
    cb: cb || noop,
    client: client,
    broker: this._broker,
    topic: newSubTopic
  }, brokerPublish, subs, addedSubDone)
}

function qosGreaterThanOne (sub) {
  return sub.qos > 0
}

function brokerPublish (sub, cb) {
  var client = this.client
  var encoded = JSON.stringify(new Sub(client.id, sub.topic, sub.qos))
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
  this._parallel({
    cb: cb || noop,
    client: client,
    broker: this._broker,
    topic: rmSubTopic
  }, brokerPublish, subs, addedSubDone)
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
    broker.subscribe(subTopic, this._onMessage, this._setup.bind(this))
  }
})

module.exports = CachedPersistence
module.exports.Packet = Packet
