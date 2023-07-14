const DHT = require('@hyperswarm/dht-relay')
const Stream = require('@hyperswarm/dht-relay/ws')
const WebSocket = require('ws')
const Hyperswarm = require('hyperswarm')
const test = require('brittle')
const setup = require('./index')
const pino = require('pino')
const hypCrypto = require('hypercore-crypto')

test('Can access the swarm through a relay', async function (t) {
  t.plan(1)
  const host = '127.0.0.1'
  const app = await setup(pino({ level: 'warn' }), { host })

  const url = `ws://${host}:${app.server.address().port}`
  const relayedSwarm = await getRelayedSwarm(url, t)

  // TODO: figure out how to do this over testnet
  const swarm = new Hyperswarm()
  t.teardown(async () => {
    await swarm.destroy()
    await app.close()
  })

  swarm.on('connection', c => {
    t.ok('Relayed peer connected')
  })

  const key = hypCrypto.keyPair().publicKey
  swarm.join(key, { server: true })
  await swarm.flush()

  relayedSwarm.join(key)
})

async function getRelayedSwarm (url, t) {
  const socket = new WebSocket(url)

  const stream = new Stream(true, socket)
  const dht = new DHT(stream)

  const swarm = new Hyperswarm({ dht })

  t.teardown(async () => {
    await swarm.destroy()
  })

  return swarm
}
