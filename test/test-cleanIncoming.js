const test = require('node:test')
const { CallBackPersistence } = require('../callBackPersistence.js')
const { PromisifiedPersistence } = require('../promisified.js')

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

class FailingAsyncPersistence extends LegacyAsyncPersistence {
  async cleanIncoming (client) {
    throw new Error('backend is down')
  }
}

const wrap = (AsyncImpl) => new CallBackPersistence(() => new AsyncImpl())

function setBroker (instance) {
  instance.broker = {
    id: 'broker-1',
    subscribe (topic, fn, done) { done() }
  }
}

test('a wrapped persistence without cleanIncoming does not advertise it', async (t) => {
  t.plan(2)
  const warned = new Promise(resolve => process.once('warning', resolve))
  t.assert.equal(typeof wrap(LegacyAsyncPersistence).cleanIncoming, 'undefined')
  // withdrawing it silently would leave the broker vulnerable without a trace
  t.assert.equal((await warned).name, 'AedesPersistenceWarning')
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
  t.plan(3)
  const instance = wrap(ModernAsyncPersistence)

  const done = new Promise((resolve, reject) => {
    instance.cleanIncoming({ id: 'queued' }, (err) => {
      if (err) { reject(err) } else { resolve() }
    })
  })
  t.assert.deepEqual(instance.asyncPersistence.cleaned, [])

  setBroker(instance)
  await done
  t.assert.deepEqual(instance.asyncPersistence.cleaned, ['queued'])
  t.assert.equal(instance.ready, true)
})

// aedes calls cleanIncoming without a callback and chains on the result, both
// in lib/client.js and in lib/handlers/connect.js.
test('cleanIncoming returns a promise when no callback is given', async (t) => {
  t.plan(2)
  const instance = wrap(ModernAsyncPersistence)

  const queued = instance.cleanIncoming({ id: 'queued' })
  t.assert.ok(queued instanceof Promise)

  setBroker(instance)
  await queued
  t.assert.deepEqual(instance.asyncPersistence.cleaned, ['queued'])
})

test('a failing cleanIncoming reports the error instead of a clean client', async (t) => {
  t.plan(4)
  const instance = wrap(FailingAsyncPersistence)
  setBroker(instance)

  const err = await new Promise(resolve => {
    instance.cleanIncoming({ id: 'abcde' }, (err, client) => {
      t.assert.equal(client, undefined)
      resolve(err)
    })
  })
  t.assert.ok(err instanceof Error)
  t.assert.equal(err.message, 'backend is down')

  await t.assert.rejects(
    () => instance.cleanIncoming({ id: 'abcde' }),
    { message: 'backend is down' }
  )
})

// PromisifiedPersistence defines cleanIncoming unconditionally and only throws
// at call time, so a plain typeof check on it would advertise the capability
// and then fail on every clean-session CONNECT.
test('a persistence promisified from a pre-11 backend does not advertise cleanIncoming', (t) => {
  t.plan(1)
  const instance = new CallBackPersistence(() => new PromisifiedPersistence({}))
  t.assert.equal(typeof instance.cleanIncoming, 'undefined')
})

test('a subclass keeps its own cleanIncoming when the backend has none', (t) => {
  t.plan(1)
  class SubPersistence extends CallBackPersistence {
    cleanIncoming (client, cb) {
      cb(null, client)
    }
  }
  const instance = new SubPersistence(() => new LegacyAsyncPersistence())
  t.assert.equal(typeof instance.cleanIncoming, 'function')
})
