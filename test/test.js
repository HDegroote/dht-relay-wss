const Hyperswarm = require('hyperswarm')
const test = require('brittle')
const hypCrypto = require('hypercore-crypto')
const createTestnet = require('@hyperswarm/testnet')
const DHT = require('hyperdht')
const fastify = require('fastify')

const { getRelayedSwarm } = require('./helpers')
const DhtRelayWss = require('../index')

test('Shutdown with active clients waits a while for them to exit cleanly', async function (t) {
  const tConn = t.test('Relayed connections estbalished')
  tConn.plan(2)

  // sub test plans seem bugged if combined with non-sub
  const tRest = t.test('main')
  tRest.plan(4)

  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap

  const app = fastify()
  const dht = new DHT({ bootstrap })

  const relay = new DhtRelayWss(app, dht, { sShutdownMargin: 1 })
  await relay.ready()

  const url = relay.wsAddress
  const relayedSwarm = await getRelayedSwarm(url, t)
  const relayedSwarm2 = await getRelayedSwarm(url, t)

  const swarm = new Hyperswarm({ bootstrap })
  t.teardown(async () => {
    await swarm.destroy()
    testnet.destroy()
  })

  swarm.on('connection', async c => {
    c.on('error', e => console.log('swallowing connection error', e))
    tConn.ok('Relayed peer connected')
  })

  const key = hypCrypto.keyPair().publicKey
  swarm.join(key, { server: true })
  await swarm.flush()

  relayedSwarm.join(key)
  relayedSwarm2.join(key)

  await tConn

  relay.on('ws-closing-signal', async ({ nrClients, sShutdownMargin }) => {
    tRest.is(nrClients, 2, 'signalling expected nr of clients')
    tRest.is(sShutdownMargin, 1, 'sanity check')

    await relayedSwarm.destroy()
  })

  relay.on('ws-closing-force', ({ nrRemainingClients }) => {
    tRest.is(nrRemainingClients, 1, 'force closes still-connected clients after timeout') // Note: this tests the event, but not the actual behaviour
  })

  relay.on('ws-closing-done', () => {
    tRest.pass('emits ws-closing-done event')
  })

  await relay.close()
})

test('Shutdown with active clients early-returns when all exit clenaly', async function (t) {
  const tConn = t.test('Relayed connections estbalished')
  tConn.plan(2)

  // sub test plans seem bugged if combined with non-sub
  const tRest = t.test('main')
  tRest.plan(3)

  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap

  const app = fastify()
  const dht = new DHT({ bootstrap })

  const relay = new DhtRelayWss(app, dht, { sShutdownMargin: 100 })
  await relay.ready()

  const url = relay.wsAddress
  const relayedSwarm = await getRelayedSwarm(url, t)
  const relayedSwarm2 = await getRelayedSwarm(url, t)

  const swarm = new Hyperswarm({ bootstrap })
  t.teardown(async () => {
    console.log('tearding down')
    await swarm.destroy()
    testnet.destroy()
  })

  swarm.on('connection', async c => {
    c.on('error', e => console.log('swallowing connection error', e))
    tConn.ok('Relayed peer connected')
  })

  const key = hypCrypto.keyPair().publicKey
  swarm.join(key, { server: true })
  await swarm.flush()

  relayedSwarm.join(key)
  relayedSwarm2.join(key)

  await tConn

  relay.on('ws-closing-signal', async ({ nrClients, sShutdownMargin }) => {
    tRest.is(nrClients, 2, 'signalling expected nr of clients')
    tRest.is(sShutdownMargin, 100, 'sanity check')

    await relayedSwarm.destroy()
    await relayedSwarm2.destroy()
  })

  relay.on('ws-closing-done', () => {
    tRest.pass('emits ws-closing-done event')
  })

  await relay.close()
})
