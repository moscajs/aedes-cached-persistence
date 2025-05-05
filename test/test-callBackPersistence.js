const test = require('node:test')

const { PromisifiedPersistence } = require('../promisified.js')
const { CallBackPersistence } = require('../callBackPersistence.js')
const { TestPersistence } = require('./helpers/testPersistence.js')
const Memory = require('aedes-persistence')
const abs = require('../abstract.js')

const persistence = (opts) => {
  const asyncInstanceFactory = () => {
    const instance = new PromisifiedPersistence(new TestPersistence({ backend: Memory() }))
    instance.setup = async () => {}
    return instance
  }
  return new CallBackPersistence(asyncInstanceFactory, opts)
}

abs({
  test,
  persistence
})
