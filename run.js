#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')

const setup = require('./index')

function loadConfig () {
  return {
    wsPort: process.WS_PORT || 8080,
    dhtPort: process.DHT_PORT,
    logLevel: process.LOG_LEVEL || 'info',
    host: process.HOST || '127.0.0.1',
    sShutdownMargin: process.S_SHUTD0WN_MARGIN || 10
  }
}

async function main () {
  const { wsPort, dhtPort, logLevel, host, sShutdownMargin } = loadConfig()
  const logger = pino({ level: logLevel })

  await setup(logger, { wsPort, dhtPort, logLevel, host, sShutdownMargin })
}

main()
