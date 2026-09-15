const test = require('node:test')
const { CallBackPersistence } = require('../callBackPersistence.js')

// A pre-11 async persistence: aedes feature-detects cleanIncoming, so wrapping
// this one must not advertise the method.
class LegacyAsyncPersistence {
  async setup () {}
}

class ModernAsyncPersistence extends LegacyAsyncPersistence {
  constructor () {
    super()
    this.cleaned = []
  }

  async cleanIncoming (client) {
    this.cleaned.push(client.id)
  }
}

const wrap = (AsyncImpl) => new CallBackPersistence(() => new AsyncImpl())

function setBroker (instance) {
  instance.broker = {
    id: 'broker-1',
    subscribe (topic, fn, done) { done() }
  }
}

test('a wrapped persistence without cleanIncoming does not advertise it', (t) => {
  t.plan(1)
  t.assert.equal(typeof wrap(LegacyAsyncPersistence).cleanIncoming, 'undefined')
})

test('cleanIncoming delegates once per client and yields the client back', async (t) => {
  t.plan(3)
  const instance = wrap(ModernAsyncPersistence)
  t.assert.equal(typeof instance.cleanIncoming, 'function')

  setBroker(instance)

  const client = await new Promise((resolve, reject) => {
    instance.cleanIncoming({ id: 'abcde' }, (err, client) => {
      if (err) { reject(err) } else { resolve(client) }
    })
  })
  t.assert.equal(client.id, 'abcde')
  t.assert.deepEqual(instance.asyncPersistence.cleaned, ['abcde'])
})

test('a cleanIncoming issued before ready runs once the persistence is ready', async (t) => {
  t.plan(2)
  const instance = wrap(ModernAsyncPersistence)

  const done = new Promise(resolve => {
    instance.cleanIncoming({ id: 'queued' }, resolve)
  })
  t.assert.deepEqual(instance.asyncPersistence.cleaned, [])

  setBroker(instance)
  await done
  t.assert.deepEqual(instance.asyncPersistence.cleaned, ['queued'])
})
