'use strict'

const QlobberSub = require('qlobber/aedes/qlobber-sub')
const { Packet } = require('aedes-persistence')
const EE = require('events').EventEmitter
const inherits = require('util').inherits
const MultiStream = require('multistream')
const parallel = require('fastparallel')
const QlobberOpts = {
  wildcard_one: '+',
  wildcard_some: '#',
  separator: '/',
  match_empty_levels: true
}
const newSubTopic = '$SYS/sub/add'
const rmSubTopic = '$SYS/sub/rm'
const subTopic = '$SYS/sub/+'

function CachedPersistence (opts) {
  if (!(this instanceof CachedPersistence)) {
    return new CachedPersistence(opts)
  }

  EE.call(this)

  this.ready = false
  this.destroyed = false
  this._parallel = parallel()
  this._trie = new QlobberSub(QlobberOpts)
  this._waiting = {}

  const that = this

  this.once('ready', function () {
    that.ready = true
  })

  this._onMessage = function onSubMessage (packet, cb) {
    var decoded = JSON.parse(packet.payload)
    var clientId = decoded.clientId
    for (var i = 0; i < decoded.subs.length; i++) {
      var sub = decoded.subs[i]
      sub.clientId = clientId
      if (packet.topic === newSubTopic) {
        if (sub.qos > 0) {
          that._trie.add(sub.topic, sub)
        } else {
          that._trie.remove(sub.topic, sub)
        }
      } else if (packet.topic === rmSubTopic) {
        that._trie.remove(sub.topic, sub)
      }
    }
    var action = packet.topic === newSubTopic ? 'sub_' : 'unsub_'
    var key = clientId + '-' + action
    if (decoded.subs.length > 0) {
      key = clientId + '-' + action + decoded.subs[0].topic
    }
    var waiting = that._waiting[key]
    that._waiting[key] = undefined
    if (waiting) {
      process.nextTick(waiting)
    }
    cb()
  }
}

inherits(CachedPersistence, EE)

CachedPersistence.prototype._waitFor = function (client, action, cb) {
  this._waiting[client.id + '-' + action] = cb
}

CachedPersistence.prototype._addedSubscriptions = function (client, subs, cb) {
  if (!this.ready) {
    this.once('ready', this._addedSubscriptions.bind(this, client, subs, cb))
    return
  }

  var errored = false

  this._waitFor(client, 'sub_' + subs[0].topic, function (err) {
    if (!errored && err) {
      return cb(err)
    }
    if (!errored) {
      cb(null, client)
    }
  })

  if (subs.length === 0) {
    return cb(null, client)
  }

  const ctx = {
    cb: cb || noop,
    client: client,
    broker: this._broker,
    topic: newSubTopic,
    brokerPublish: brokerPublish
  }
  ctx.brokerPublish(subs, function (err) {
    if (err) {
      errored = true
      cb(err)
    }
  })
}

function brokerPublish (subs, cb) {
  var encoded = JSON.stringify({ clientId: this.client.id, subs: subs })
  var packet = new Packet({
    topic: this.topic,
    payload: encoded
  })
  this.broker.publish(packet, cb)
}

function noop () {}

CachedPersistence.prototype._removedSubscriptions = function (client, subs, cb) {
  if (!this.ready) {
    this.once('ready', this._removedSubscriptions.bind(this, client, subs, cb))
    return
  }
  var errored = false
  var key = subs

  if (subs.length > 0) {
    key = subs[0].topic
  }
  this._waitFor(client, 'unsub_' + key, function (err) {
    if (!errored && err) {
      return cb(err)
    }
    if (!errored) {
      cb(null, client)
    }
  })

  const ctx = {
    cb: cb || noop,
    client: client,
    broker: this._broker,
    topic: rmSubTopic,
    brokerPublish: brokerPublish
  }
  ctx.brokerPublish(subs, function (err) {
    if (err) {
      errored = true
      cb(err)
    }
  })
}

CachedPersistence.prototype.subscriptionsByTopic = function (topic, cb) {
  if (!this.ready) {
    this.once('ready', this.subscriptionsByTopic.bind(this, topic, cb))
    return this
  }

  cb(null, this._trie.match(topic))
}

CachedPersistence.prototype.cleanSubscriptions = function (client, cb) {
  const that = this
  this.subscriptionsByClient(client, function (err, subs, client) {
    if (err || !subs) { return cb(err, client) }
    subs = subs.map(subToTopic)
    that.removeSubscriptions(client, subs, cb)
  })
}

CachedPersistence.prototype.outgoingEnqueueCombi = function (subs, packet, cb) {
  this._parallel({
    persistence: this,
    packet: packet
  }, outgoingEnqueue, subs, cb)
}

function outgoingEnqueue (sub, cb) {
  this.persistence.outgoingEnqueue(sub, this.packet, cb)
}

CachedPersistence.prototype.createRetainedStreamCombi = function (patterns) {
  const that = this
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

module.exports = CachedPersistence
module.exports.Packet = Packet
