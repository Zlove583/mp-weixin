'use strict'

const assert = require('node:assert/strict')

const originalTextEncoder = global.TextEncoder
global.TextEncoder = undefined
delete require.cache[require.resolve('../utils/xlsx-builder')]
const { buildXLSX } = require('../utils/xlsx-builder')

const buffer = buildXLSX([{
  name: '月度汇总',
  rows: [[{ v: '营业收入', t: 's', s: 0 }, { v: 1200, t: 'n', s: 2 }]],
}])

assert.ok(buffer instanceof ArrayBuffer)
const bytes = new Uint8Array(buffer)
assert.equal(bytes[0], 0x50)
assert.equal(bytes[1], 0x4b)
assert.ok(bytes.length > 500)

global.TextEncoder = originalTextEncoder
console.log('xlsx-builder mobile compatibility test passed')
