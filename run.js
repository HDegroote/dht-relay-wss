#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')
const goodbye = require('graceful-goodbye')
const idEnc = require('hypercore-id-encoding')

const setup = require('./index')

function loadConfig () {
  const res = {
    wsPort: parseInt(process.env.WS_PORT || 8080),
    dhtPort: parseInt(process.env.DHT_PORT || 0),
    logLevel: process.env.LOG_LEVEL || 'info',
    host: process.env.HOST || '127.0.0.1',
    dhtHost: process.env.DHT_HOST || '0.0.0.0',
    // Should be < 10s, lest it interfere with a fastify timeout
    // (logs a caught error if it does, so not dramatic)
    sShutdownMargin: process.env.S_SHUTDOWN_MARGIN == null
      ? 5
      : parseInt(process.env.S_SHUTDOWN_MARGIN)
  }

  if (process.env.DHT_RELAY_WSS_PROM_SHARED_SECRET) {
    res.dhtPromSharedSecret = idEnc.decode(idEnc.normalize(
      process.env.DHT_RELAY_WSS_PROM_SHARED_SECRET
    ))

    res.dhtPromScraperPublicKey = idEnc.decode(idEnc.normalize(
      process.env.DHT_RELAY_WSS_PROM_PUBLIC_KEY
    ))

    res.aliasForProm = process.env.DHT_RELAY_WSS_PROM_ALIAS
    if (!res.aliasForProm) throw new Error('DHT_RELAY_WSS_PROM_ALIAS required when connecting to dht-prometheus')
  }
  return res
}

async function main () {
  const config = loadConfig()
  const { wsPort, dhtPort, dhtHost, logLevel, host, sShutdownMargin } = config

  const logger = pino({ level: logLevel })

  // TODO: clean up lifecycle/setup flow
  const app = await setup(logger, { wsPort, dhtPort, dhtHost, logLevel, host, sShutdownMargin })

  let promClient = null
  if (config.dhtPromSharedSecret) {
    const alias = config.aliasForProm
    promClient = setupPromClient(
      config.dhtPromSharedSecret,
      config.dhtPromScraperPublicKey,
      alias
    )

    promClient.on('register-alias-success', ({ updated }) => {
      logger.info(`Registered alias ${alias} successfully (update: ${updated})`)
    })

    promClient.on('register-alias-error', (e) => {
      logger.error('Error while registering alias')
      logger.error(e)
    })

    // TODO: These should be debug level
    promClient.on('metrics-request', ({ uid, remotePublicKey }) => {
      logger.info(`Metrics requested by ${idEnc.normalize(remotePublicKey)} (uid: ${uid})`)
    })
    promClient.on('metrics-success', ({ uid }) => {
      logger.info(`Metrics scraped success (uid: ${uid})`)
    })

    promClient.on('metrics-error', ({ error, uid }) => {
      logger.info(`Error while scraping metrics (uid: ${uid})`)
      logger.info(error) // Not worth logging on error for this
    })
  }

  goodbye(async () => {
    logger.info('Closing down the overall server')
    try {
      await app.close()
    } catch (e) {
      console.error('error while shutting down overall server:', e)
    }
    logger.info('Closed down the overall server')

    if (promClient && promClient.opened) await promClient.close()

    logger.info('Exiting program')
  })

  if (promClient) {
    await promClient.ready()
  }
}

function setupPromClient (secret, scraperPubKey, alias) {
  // TODO: make deps optional, so it makes sense to only import them here
  const HyperDHT = require('hyperdht')
  const DhtPromClient = require('dht-prom-client')
  const promClient = require('prom-client') // Registry comes from fastify-metrics

  const dht = new HyperDHT()
  return new DhtPromClient(dht, promClient, scraperPubKey, alias, secret)
}

main()
