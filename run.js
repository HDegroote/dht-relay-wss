#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')

const setup = require('./index')

function loadConfig () {
  return {
    wsPort: parseInt(process.env.WS_PORT || 8080),
    dhtPort: parseInt(process.env.DHT_PORT || 0),
    logLevel: process.env.LOG_LEVEL || 'info',
    host: process.env.HOST || '127.0.0.1',
    // Should be < 10s, lest it interfere with a fastify timeout
    // (logs a caught error if it does, so not dramatic)
    sShutdownMargin: process.env.S_SHUTDOWN_MARGIN == null
      ? 5
      : parseInt(process.env.S_SHUTDOWN_MARGIN)
  }
}

async function main () {
  const { wsPort, dhtPort, logLevel, host, sShutdownMargin } = loadConfig()
  const logger = pino({ level: logLevel })

  await setup(logger, { wsPort, dhtPort, logLevel, host, sShutdownMargin })
}

main()
