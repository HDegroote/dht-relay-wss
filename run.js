#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')
const goodbye = require('graceful-goodbye')
const DHT = require('hyperdht')
const fastify = require('fastify')
const promClient = require('prom-client')

const DhtRelayWss = require('./index')
const instrument = require('./lib/instrument')

function loadConfig () {
  const res = {
    wsPort: parseInt(process.env.DHT_RELAY_WS_PORT || 0),
    dhtPort: parseInt(process.env.DHT_RELAY_DHT_PORT || 0),
    logLevel: process.env.DHT_RELAY_LOG_LEVEL || 'info',
    host: process.env.DHT_RELAY_HTTP_HOST || '127.0.0.1',
    // Should be < 10s, lest it interfere with a fastify timeout
    // (logs a caught error if it does, so not dramatic)
    sShutdownMargin: process.env.DHT_RELAY_S_SHUTDOWN_MARGIN == null
      ? 5
      : parseInt(process.env.S_SHUTDOWN_MARGIN)
  }

  if (process.env.DHT_RELAY_BOOTSTRAP_PORT) { // For tests
    res.bootstrap = [{
      port: parseInt(process.env.DHT_RELAY_BOOTSTRAP_PORT),
      host: '127.0.0.1'
    }]
  }

  return res
}

async function main () {
  const { wsPort, dhtPort, dhtHost, logLevel, host, sShutdownMargin, bootstrap } = loadConfig()
  const logger = pino({ level: logLevel })
  promClient.collectDefaultMetrics()

  logger.info('Starting DHT relay')

  const dht = new DHT({ port: dhtPort, host: dhtHost, bootstrap })
  const app = fastify({ logger })

  const dhtRelay = new DhtRelayWss(app, dht, { sShutdownMargin })
  setupLogging(dhtRelay, logger)
  instrument(dhtRelay)

  goodbye(async () => {
    try {
      logger.info('Closing down the wss server')
      await app.close()
      logger.info('Closing the relay')
      await dhtRelay.close()
      logger.info('Exiting program')
    } catch (e) {
      console.error('error while shutting down', e)
    }
  })

  await dhtRelay.ready()
  logger.info(`DHT: ${dht.host}:${dht.port} (firewalled: ${dht.firewalled})`)

  app.listen({
    port: wsPort,
    host
  })
}

function setupLogging (dhtRelay, logger) {
  dhtRelay.on('conn-open', ({ id }) => {
    logger.info(`Started relaying to ${id}`)
  })
  dhtRelay.on('conn-error', ({ error, id }) => {
    // Usually expected (timeouts etc)
    logger.info(`Relay connection error on connection ${id}: ${error.stack}`)
  })
  dhtRelay.on('conn-close', ({ id }) => {
    logger.info(`Stopped relaying to ${id}`)
  })

  dhtRelay.on('ws-closing-signal', ({ sShutdownMargin, nrClients }) => {
    logger.info(`Signalling ${nrClients} clients that we are shutting down in max ${sShutdownMargin}s`)
  })
  dhtRelay.on('ws-closing-force', ({ nrRemainingClients }) => {
    logger.warn(`force-closing connection to ${nrRemainingClients} clients`)
  })
  dhtRelay.on('ws-closing-done', () => {
    logger.info('Closed websocket server connections')
  })
}

main()
