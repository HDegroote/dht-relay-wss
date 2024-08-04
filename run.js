#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')
const goodbye = require('graceful-goodbye')

const setup = require('./index')

function loadConfig () {
  const res = {
    wsPort: parseInt(process.env.DHT_RELAY_WS_PORT || 0),
    dhtPort: parseInt(process.env.DHT_RELAY_DHT_PORT || 0),
    logLevel: process.env.DHT_RELAY_LOG_LEVEL || 'info',
    host: process.env.DHT_RELAY_HTTP_HOST || '127.0.0.1',
    // dhtHost: process.env.DHT_HOST || '0.0.0.0',
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

  const app = await setup(logger, { wsPort, dhtPort, dhtHost, logLevel, host, sShutdownMargin, bootstrap })

  goodbye(async () => {
    logger.info('Closing down the overall server')
    try {
      await app.close()
    } catch (e) {
      console.error('error while shutting down overall server:', e)
    }
    logger.info('Closed down the overall server')

    logger.info('Exiting program')
  })
}

main()
