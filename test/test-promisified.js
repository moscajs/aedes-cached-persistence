const test = require('node:test')
const { TestPersistence } = require('./helpers/testPersistence.js')
const { PromisifiedPersistence } = require('../promisified.js')
const Memory = require('aedes-persistence')

const persistence = () => new TestPersistence({ backend: Memory() })

// basic check of promisified,the full test has already been done in abs()
test('promisified', async (t) => {
  t.plan(1)
  const client = {
    id: 'abcde'
  }
  const packet = {
    cmd: 'publish',
    topic: 'hello',
    payload: Buffer.from('world'),
    qos: 2,
    dup: false,
    length: 14,
    retain: false,
    messageId: 42
  }
  const p = new PromisifiedPersistence(persistence())

  await p.incomingStorePacket(client, packet)
  const retrieved = await p.incomingGetPacket(client, {
    messageId: packet.messageId
  })
  t.assert.equal(retrieved.topic, 'hello')
})
