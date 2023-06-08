require('dotenv').config()
const pino = require('pino')
const DHT = require('@hyperswarm/dht')
const { relay } = require('@hyperswarm/dht-relay')
const { WebSocketServer } = require('ws')
const Stream = require('@hyperswarm/dht-relay/ws')
const promClient = require('prom-client')
const goodbye = require('graceful-goodbye')

function loadConfig () {
  return {
    wsPort: process.WS_PORT || 8080,
    dhtPort: process.DHT_PORT,
    logLevel: process.LOG_LEVEL || 'info'
  }
}

function setupRelayServer (wsPort, dht, logger) {
  const server = new WebSocketServer({ port: wsPort })

  // TODO: decide whether to listen for server error events

  server.on('connection', (socket, req) => {
    // req is a http.IncomingMessage object
    const ip = req.socket.remoteAddress
    const port = req.socket.remotePort
    const id = `${ip}--${port}`
    socket.on('error', (error) => {
      // Socket errors are often unexpected hang-ups etc, so we swallow them
      logger.info(`Socket error for connection at ${id} (${error.message})`)
    })

    socket.on('close', () => {
      logger.info(`Stopped relaying to ${id}`)
    })

    logger.info(`Relaying to ${id}`)
    relay(dht, new Stream(false, socket))

    socket.send('You are being relayed')
  })

  return server
}

async function main () {
  const { wsPort, dhtPort, logLevel } = loadConfig()
  const logger = pino({ level: logLevel })

  logger.info('Starting program')

  promClient.collectDefaultMetrics()

  const dht = new DHT({ port: dhtPort })
  const server = setupRelayServer(wsPort, dht, logger)

  logger.info(`Running the relay on port ${wsPort}`)
  logger.info(`Indicated DHT port: ${dht.port}`)

  goodbye(async () => {
    logger.info('Closing down DHT')
    try {
      await dht.destroy()
    } catch (e) {
      logger.error(e)
    }

    logger.info('Closed down DHT')

    logger.info('Closing down websocket server')
    try {
      await new Promise(resolve => server.close(resolve))
    } catch (e) {
      logger.error(e)
    }
    logger.info('Closed websocket server')

    logger.info('Exiting program')
  })
}

main()
