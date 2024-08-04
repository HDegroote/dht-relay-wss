#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')
const goodbye = require('graceful-goodbye')
const DHT = require('hyperdht')
const fastify = require('fastify')
const promClient = require('prom-client')
const idEnc = require('hypercore-id-encoding')

const DhtRelayWss = require('./index')
const instrument = require('./lib/instrument')
const setupDhtPromClient = require('./lib/dht-prom-client')
const safetyCatch = require('safety-catch')

function loadConfig () {
  const res = {
    wsPort: parseInt(process.env.DHT_RELAY_WS_PORT || 0),
    dhtPort: parseInt(process.env.DHT_RELAY_DHT_PORT || 0),
    logLevel: process.env.DHT_RELAY_LOG_LEVEL || 'info',
    wsHost: process.env.DHT_RELAY_WS_HOST || '127.0.0.1',
    // Should be < 10s, lest it interfere with a fastify timeout
    // (logs a caught error if it does, so not dramatic)
    sShutdownMargin: process.env.DHT_RELAY_S_SHUTDOWN_MARGIN == null
      ? 5
      : parseInt(process.env.DHT_RELAY_S_SHUTDOWN_MARGIN)
  }

  if (process.env.DHT_RELAY_BOOTSTRAP_PORT) { // For tests
    res.bootstrap = [{
      port: parseInt(process.env.DHT_RELAY_BOOTSTRAP_PORT),
      host: '127.0.0.1'
    }]
  }

  if (process.env.DHT_RELAY_PROMETHEUS_ALIAS) {
    res.prometheusAlias = process.env.DHT_RELAY_PROMETHEUS_ALIAS
    try {
      res.prometheusSharedSecret = idEnc.decode(process.env.DHT_RELAY_PROMETHEUS_SHARED_SECRET)
      res.prometheusScraperPublicKey = idEnc.decode(process.env.DHT_RELAY_PROMETHEUS_SCRAPER_PUBLIC_KEY)
      res.prometheusServiceName = 'dht-relay-wss'
    } catch (error) {
      console.error(error)
      console.error('If DHT_RELAY_PROMETHEUS_ALIAS is set, then DHT_RELAY_PROMETHEUS_SHARED_SECRET and DHT_RELAY_PROMETHEUS_SCRAPER_PUBLIC_KEY must be set to valid keys')
      process.exit(1)
    }
  }

  return res
}

async function main () {
  const config = loadConfig()
  const { wsPort, wsHost, dhtPort, logLevel, sShutdownMargin, bootstrap } = config

  const logger = pino({ level: logLevel })
  promClient.collectDefaultMetrics()

  logger.info('Starting DHT relay')

  const dht = new DHT({ port: dhtPort, bootstrap })
  const app = fastify({ logger })

  const dhtRelay = new DhtRelayWss(app, dht, {
    sShutdownMargin,
    wsPort,
    wsHost
  })
  setupLogging(dhtRelay, logger)
  instrument(dhtRelay)

  let dhtPromClient = null
  if (config.prometheusAlias) {
    const { prometheusAlias, prometheusSharedSecret, prometheusScraperPublicKey, prometheusServiceName } = config
    logger.info(`Setting up dht prom client with alias ${prometheusAlias}`)

    // TODO: look into re-using the existing DHT
    const dht = new DHT({ bootstrap })

    dhtPromClient = setupDhtPromClient(dht, promClient, logger, {
      prometheusAlias, prometheusSharedSecret, prometheusScraperPublicKey, prometheusServiceName
    })
  }

  goodbye(async () => {
    try {
      if (dhtPromClient) dhtPromClient.close().catch(safetyCatch)

      logger.info('Closing the relay')
      await dhtRelay.close()
      logger.info('Exiting program')
    } catch (e) {
      console.error('error while shutting down', e)
    }
  })

  await dhtRelay.ready()
  if (dhtPromClient) await dhtPromClient.ready()

  logger.info(`DHT: ${dht.host}:${dht.port} (firewalled: ${dht.firewalled})`)
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
