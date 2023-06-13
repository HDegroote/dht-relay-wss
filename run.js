#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')

const setup = require('./index')

function loadConfig () {
  return {
    wsPort: process.env.WS_PORT || 8080,
    dhtPort: process.env.DHT_PORT,
    logLevel: process.env.LOG_LEVEL || 'info',
    host: process.env.HOST || '127.0.0.1',
    sShutdownMargin: process.env.S_SHUTDOWN_MARGIN == null
      ? 10
      : process.env.S_SHUTDOWN_MARGIN
  }
}

async function main () {
  const { wsPort, dhtPort, logLevel, host, sShutdownMargin } = loadConfig()
  const logger = pino({ level: logLevel })

  await setup(logger, { wsPort, dhtPort, logLevel, host, sShutdownMargin })
}

main()
