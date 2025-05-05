const test = require('node:test')
const Memory = require('aedes-persistence')
const abs = require('../abstract')
const { TestPersistence } = require('./helpers/testPersistence.js')

const persistence = () => new TestPersistence({ backend: Memory() })

abs({
  test,
  persistence
})
