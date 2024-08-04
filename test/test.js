const Hyperswarm = require('hyperswarm')
const test = require('brittle')
const pino = require('pino')
const hypCrypto = require('hypercore-crypto')
const createTestnet = require('@hyperswarm/testnet')

const { getRelayedSwarm } = require('./helpers')
const setup = require('../index')

test('Can access the swarm through a relay', async function (t) {
  t.plan(1)

  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap

  const host = '127.0.0.1'
  const app = await setup(pino({ level: 'warn' }), { host, bootstrap })

  const url = `ws://${host}:${app.server.address().port}`
  const relayedSwarm = await getRelayedSwarm(url, t)

  const swarm = new Hyperswarm({ bootstrap })
  t.teardown(async () => {
    await swarm.destroy()
    await app.close()
    testnet.destroy()
  })

  swarm.on('connection', c => {
    c.on('error', e => console.log('swallowing connection error', e))
    t.ok('Relayed peer connected')
  })

  const key = hypCrypto.keyPair().publicKey
  swarm.join(key, { server: true })
  await swarm.flush()

  relayedSwarm.join(key)
})
