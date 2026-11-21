'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { EventEmitter } = require('node:events')

const root = path.resolve(__dirname, '../..')
const credentials = { TENCENT_SECRET_ID: 'test-secret-id', TENCENT_SECRET_KEY: 'test-secret-key' }

function load(file, env) {
  const requests = []
  const errors = []
  const exits = []
  let reads = 0
  let downloads = 0
  const collection = {
    where() { return this },
    orderBy() { return this },
    limit() { return this },
    async get() { return { data: [] } },
    async remove() {},
    async add() {},
  }
  const cloud = {
    init() {},
    getWXContext() { return { OPENID: 'test-user' } },
    database() { return { collection: () => collection, serverDate: () => 0 } },
    async downloadFile() {
      downloads += 1
      return { fileContent: Buffer.from('fake image') }
    },
  }
  const https = {
    request(options, callback) {
      requests.push(options)
      const request = new EventEmitter()
      request.setTimeout = () => {}
      request.write = () => {}
      request.end = () => {
        const response = new EventEmitter()
        callback(response)
        queueMicrotask(() => {
          response.emit('data', JSON.stringify({ Response: { TextDetections: [] } }))
          response.emit('end')
        })
      }
      return request
    },
  }
  const context = {
    exports: {},
    process: { env, exit: (code) => exits.push(code) },
    console: { log() {}, error: (...args) => errors.push(args.join(' ')) },
    require(name) {
      if (name === 'wx-server-sdk') return cloud
      if (name === 'https') return https
      if (name === 'fs') return {
        existsSync: () => true,
        readFileSync: () => { reads += 1; return Buffer.from('fake image') },
      }
      if (name === 'crypto' || name === 'path') return require(name)
      throw new Error(`Unexpected dependency: ${name}`)
    },
  }
  const result = vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context)
  return { context, result, requests, errors, exits, reads: () => reads, downloads: () => downloads }
}

async function main() {
  const missingCases = [
    {},
    { TENCENT_SECRET_ID: credentials.TENCENT_SECRET_ID },
    { TENCENT_SECRET_KEY: credentials.TENCENT_SECRET_KEY },
    { ...credentials, TENCENT_SECRET_ID: '   ' },
    { ...credentials, TENCENT_SECRET_KEY: '\t' },
  ]

  for (const env of missingCases) {
    const local = load('test-ocr.js', env)
    await local.result
    assert.deepEqual(local.exits, [1])
    assert.match(local.errors.join('\n'), /TENCENT_SECRET_ID.*TENCENT_SECRET_KEY/)
    assert.equal(local.reads(), 0)
    assert.equal(local.requests.length, 0)

    const cloud = load('mp-weixin/cloudfunctions/ocr/index.js', env)
    const result = await cloud.context.exports.main({ action: 'recognize', docType: 'bank_receipt', fileID: 'test-file' })
    assert.equal(result.code, -1)
    assert.match(result.message, /TENCENT_SECRET_ID.*TENCENT_SECRET_KEY/)
    assert.equal(cloud.downloads(), 0)
    assert.equal(cloud.requests.length, 0)
    assert.equal((await cloud.context.exports.main({ action: 'history' })).code, 0)
    assert.equal((await cloud.context.exports.main({ action: 'delete', recordId: 'test-record' })).code, 0)
  }

  const local = load('test-ocr.js', credentials)
  await local.result
  assert.deepEqual(local.exits, [])
  assert.equal(local.requests.length, 3)

  const cloud = load('mp-weixin/cloudfunctions/ocr/index.js', credentials)
  const result = await cloud.context.exports.main({ action: 'recognize', docType: 'bank_receipt', fileID: 'test-file' })
  assert.equal(result.code, 0)
  assert.equal(cloud.requests.length, 1)
  for (const request of [...local.requests, ...cloud.requests]) {
    assert.ok(request.headers.Authorization.includes(`Credential=${credentials.TENCENT_SECRET_ID}/`))
    assert.ok(!request.headers.Authorization.includes(credentials.TENCENT_SECRET_KEY))
  }
  for (const value of Object.values(credentials)) {
    assert.ok(![...local.errors, ...cloud.errors].join('\n').includes(value))
  }
  console.log('OCR credential tests passed (mocked requests only)')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
