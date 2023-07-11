#! /usr/bin/env node

require('dotenv').config()
const pino = require('pino')

const setup = require('./index')

function loadConfig() {
  return {
    logLevel: process.env.LOG_LEVEL || 'info',
    wsPort: parseInt(process.env.WS_PORT || 8080),
    dhtPort: parseInt(process.env.DHT_PORT || 0),
    dhtHost: process.env.DHT_HOST || '127.0.0.1',
    host: process.env.HOST || '127.0.0.1',
    sShutdownMargin:
      process.env.S_SHUTDOWN_MARGIN == null ? 10 : parseInt(process.env.S_SHUTDOWN_MARGIN)
  }
}

async function main() {
  const { wsPort, dhtPort, dhtHost, logLevel, host, sShutdownMargin } = loadConfig()
  const logger = pino({ level: logLevel })

  await setup(logger, {
    wsPort,
    dhtPort,
    dhtHost,
    logLevel,
    host,
    sShutdownMargin
  })
}

main()
