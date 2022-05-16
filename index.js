const QlobberSub = require('qlobber/aedes/qlobber-sub')
const { Packet } = require('aedes-persistence')
const MultiStream = require('multistream')
const parallel = require('fastparallel')
const { EventEmitter } = require('events')
const QlobberOpts = {
  wildcard_one: '+',
  wildcard_some: '#',
  separator: '/',
  match_empty_levels: true
}
const newSubTopic = '$SYS/sub/add'
const rmSubTopic = '$SYS/sub/rm'
const subTopic = '$SYS/sub/+'

class CachedPersistence extends EventEmitter {
  constructor (opts) {
    super()

    this.ready = false
    this.destroyed = false
    this._parallel = parallel()
    this._trie = new QlobberSub(QlobberOpts)
    this._waiting = new Map()

    this.once('ready', () => {
      this.ready = true
    })

    this._onSubMessage = this._onMessage.bind(this)
  }

  _onMessage (packet, cb) {
    const decoded = JSON.parse(packet.payload)
    const clientId = decoded.clientId
    for (let i = 0; i < decoded.subs.length; i++) {
      const sub = decoded.subs[i]
      sub.clientId = clientId
      if (packet.topic === newSubTopic) {
        if (sub.qos > 0) {
          this._trie.add(sub.topic, sub)
        } else {
          this._trie.remove(sub.topic, sub)
        }
      } else if (packet.topic === rmSubTopic) {
        this._trie.remove(sub.topic, sub)
      }
    }

    if (decoded.subs.length > 0) {
      const key = getKey(clientId, packet.topic === newSubTopic, decoded.subs[0].topic)
      const waiting = this._waiting.get(key)
      if (waiting) {
        this._waiting.delete(key)
        process.nextTick(waiting)
      }
    }
    cb()
  }

  get broker () {
    return this._broker
  }

  set broker (broker) {
    this._broker = broker
    this.broker.subscribe(subTopic, this._onSubMessage, this._setup.bind(this))
  }

  _waitFor (client, isSub, topic, cb) {
    this._waiting.set(getKey(client.id, isSub, topic), cb)
  }

  _addedSubscriptions (client, subs, cb) {
    if (!this.ready) {
      this.once('ready', this._addedSubscriptions.bind(this, client, subs, cb))
      return
    }

    if (subs.length === 0) {
      return cb(null, client)
    }

    let errored = false

    this._waitFor(client, true, subs[0].topic, (err) => {
      if (!errored && err) {
        return cb(err)
      }
      if (!errored) {
        cb(null, client)
      }
    })

    const ctx = {
      cb: cb || noop,
      client,
      broker: this._broker,
      topic: newSubTopic,
      brokerPublish
    }
    ctx.brokerPublish(subs, (err) => {
      if (err) {
        errored = true
        cb(err)
      }
    })
  }

  _removedSubscriptions (client, subs, cb) {
    if (!this.ready) {
      this.once('ready', this._removedSubscriptions.bind(this, client, subs, cb))
      return
    }
    let errored = false
    let key = subs

    if (subs.length > 0) {
      key = subs[0].topic
    }
    this._waitFor(client, false, key, (err) => {
      if (!errored && err) {
        return cb(err)
      }
      if (!errored) {
        cb(null, client)
      }
    })

    const ctx = {
      cb: cb || noop,
      client,
      broker: this._broker,
      topic: rmSubTopic,
      brokerPublish
    }
    ctx.brokerPublish(subs, (err) => {
      if (err) {
        errored = true
        cb(err)
      }
    })
  }

  subscriptionsByTopic (topic, cb) {
    if (!this.ready) {
      this.once('ready', this.subscriptionsByTopic.bind(this, topic, cb))
      return this
    }

    cb(null, this._trie.match(topic))
  }

  cleanSubscriptions (client, cb) {
    this.subscriptionsByClient(client, (err, subs, client) => {
      if (err || !subs) { return cb(err, client) }
      subs = subs.map(subToTopic)
      this.removeSubscriptions(client, subs, cb)
    })
  }

  outgoingEnqueueCombi (subs, packet, cb) {
    this._parallel({
      persistence: this,
      packet
    }, outgoingEnqueue, subs, cb)
  }

  createRetainedStreamCombi (patterns) {
    const streams = patterns.map((p) => {
      return this.createRetainedStream(p)
    })
    return MultiStream.obj(streams)
  }

  destroy (cb) {
    this.destroyed = true
    this.broker.unsubscribe(subTopic, this._onSubMessage, () => {
      if (cb) {
        cb()
      }
    })
  }

  // must emit 'ready'
  _setup () {
    this.emit('ready')
  }
}

function brokerPublish (subs, cb) {
  const encoded = JSON.stringify({ clientId: this.client.id, subs })
  const packet = new Packet({
    topic: this.topic,
    payload: encoded
  })
  this.broker.publish(packet, cb)
}

function noop () { }

function outgoingEnqueue (sub, cb) {
  this.persistence.outgoingEnqueue(sub, this.packet, cb)
}

function subToTopic (sub) {
  return sub.topic
}

function getKey (clientId, isSub, topic) {
  return clientId + '-' + (isSub ? 'sub_' : 'unsub_') + (topic || '')
}

module.exports = CachedPersistence
module.exports.Packet = Packet
