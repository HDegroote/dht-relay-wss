const process = require('process')
const { spawn } = require('child_process')
const path = require('path')
const test = require('brittle')
const NewlineDecoder = require('newline-decoder')
const createTestnet = require('hyperdht/testnet')
const { getRelayedSwarm } = require('./helpers')
const Hyperswarm = require('hyperswarm')
const hypCrypto = require('hypercore-crypto')
const axios = require('axios')

const EXEC_LOC = path.join(path.dirname(__dirname), 'run.js')

const DEBUG = true

// To force the process.on('exit') to be called on those exits too
process.prependListener('SIGINT', () => process.exit(1))
process.prependListener('SIGTERM', () => process.exit(1))

test('Integration test, happy path', async t => {
  const tSetup = t.test('Setup')
  tSetup.plan(2)

  const tConnectToRelay = t.test('connect to relay')
  tConnectToRelay.plan(1)

  const tConnection = t.test('Swarms connect across relay')
  tConnection.plan(2)

  const tDisconnectFromRelay = t.test('disconnect from relay')
  tDisconnectFromRelay.plan(1)

  const tShutdown = t.test('Shutdown')
  tShutdown.plan(1)

  const testnet = await createTestnet()
  const { bootstrap } = testnet
  t.teardown(async () => await testnet.destroy(), 1000)

  const prcRun = spawn(
    process.execPath,
    [EXEC_LOC],
    {
      env: {
        DHT_RELAY_BOOTSTRAP_PORT: testnet.bootstrap[0].port,
        DHT_RELAY_LOG_LEVEL: 'debug'
      }
    }
  )

  // To avoid zombie processes in case there's an error
  process.on('exit', () => {
    // TODO: unset this handler on clean run
    prcRun.kill('SIGKILL')
  })

  prcRun.stderr.on('data', d => {
    console.error(d.toString())
    t.fail('There should be no stderr')
  })

  let httpAddress = null
  let relayAddress = null

  const stdoutDec = new NewlineDecoder('utf-8')
  prcRun.stdout.on('data', async d => {
    if (DEBUG) console.log(d.toString())

    for (const line of stdoutDec.push(d)) {
      if (line.includes('Server listening at')) {
        httpAddress = line.match(/http:\/\/127.0.0.1:[0-9]{3,5}/)[0]
        relayAddress = httpAddress.replace('http', 'ws')
        tSetup.pass('wss server running')
      }

      if (line.includes('DHT: 127.0.0.1:')) {
        tSetup.pass('DHT node running')
      }

      if (line.includes('Started relaying to 127.0.0.1')) {
        tConnectToRelay.pass('Client connected to relay')
      }

      if (line.includes('Stopped relaying to 127.0.0.1')) {
        tDisconnectFromRelay.pass('Client disconnected from relay')
      }
    }
  })

  await tSetup

  {
    const res = await axios.get(`${httpAddress}/health`)
    t.is(res.status, 200, 'health endpoint works')
  }

  const relayedSwarm = await getRelayedSwarm(relayAddress, t)
  relayedSwarm.on('connection', c => {
    c.on('error', (e) => {
      if (DEBUG) console.log('Swallowed relayed-swarm conn error', e)
    })
    tConnection.ok('Relayed peer connected')
  })
  await tConnectToRelay

  const swarm = new Hyperswarm({ bootstrap })

  swarm.on('connection', async c => {
    c.on('error', e => {
      if (DEBUG) console.log('swallowing connection error', e)
    })
    tConnection.ok('Non-relayed peer connected')
  })

  const key = hypCrypto.keyPair().publicKey
  swarm.join(key, { server: true })
  await swarm.flush()
  relayedSwarm.join(key)

  await tConnection

  await relayedSwarm.destroy()
  await tDisconnectFromRelay
  await swarm.destroy()

  {
    const res = await axios.get(`${httpAddress}/metrics`)
    console.log(res.data)
    t.is(res.data.includes('http_request_summary_seconds'), true, 'metrics endpoint includes fastify metrics')
  }

  prcRun.on('close', () => {
    tShutdown.pass('Process exited cleanly')
  })

  prcRun.kill('SIGTERM')
  await tShutdown
})
