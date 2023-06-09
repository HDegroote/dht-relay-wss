require('dotenv').config()
const pino = require('pino')
const DHT = require('@hyperswarm/dht')
const { relay } = require('@hyperswarm/dht-relay')
const { WebSocketServer } = require('ws')
const Stream = require('@hyperswarm/dht-relay/ws')
const promClient = require('prom-client')
const goodbye = require('graceful-goodbye')
const express = require('express')
const safetyCatch = require('safety-catch')

function loadConfig () {
  return {
    wsPort: process.WS_PORT || 8080,
    dhtPort: process.DHT_PORT,
    logLevel: process.LOG_LEVEL || 'info',
    host: process.HOST,
    sShutdownMargin: process.S_SHUTD0WN_MARGIN || 10
  }
}

function setupRelayServer (wsPort, host, dht, logger) {
  const server = new WebSocketServer({ port: wsPort, host })

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

  server.once('listening', () => {
    const address = server.address()
    logger.info(`Relay server listening on ${address.address} on port ${address.port}`)
  })

  return server
}

function setupMetricsServer (port, host, logger) {
  const app = express()

  app.get('/metrics', async function (req, res, next) {
    try {
      res.set('Content-Type', promClient.register.contentType)
      res.end(await promClient.register.metrics())
    } catch (e) {
      next(e)
    }
  })

  const listener = app.listen(port, host)
  listener.once('listening', () => {
    const address = listener.address()
    logger.info(`Metrics server listening on ${address.address} on port ${address.port}`)
  })

  return listener
}

async function closeWsServer (wsServer, logger, sShutdownMargin) {
  logger.info('Closing down websocket server')
  try {
    const closeProm = new Promise(resolve => wsServer.close(resolve))
    closeProm.catch(safetyCatch)

    if (wsServer.clients.size > 0 && sShutdownMargin) {
      logger.info(`Waiting to send close signals to existing clients for ${sShutdownMargin}s (shutdown margin)`)
      await Promise.race([
        new Promise(resolve => setTimeout(resolve, sShutdownMargin * 1000)),
        closeProm // If all connections close before the timeout
      ])
    }

    const nrRemainingClients = wsServer.clients.size
    if (nrRemainingClients) {
      logger.info(`force-closing connection to ${nrRemainingClients} clients`)
      const goingAwayCode = 1001
      for (const client of wsServer.clients) {
        client.close(goingAwayCode, 'Server is going offline')
      }
    }

    await closeProm
  } catch (e) {
    logger.error(e)
  }
  logger.info('Closed websocket server')
}

async function main () {
  const { wsPort, dhtPort, logLevel, host, sShutdownMargin } = loadConfig()
  const logger = pino({ level: logLevel })

  logger.info('Starting program')

  promClient.collectDefaultMetrics()

  const dht = new DHT({ port: dhtPort })
  const wsServer = setupRelayServer(wsPort, host, dht, logger)
  const metricsServer = setupMetricsServer(10000, host, logger)

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

    await closeWsServer(wsServer, logger, sShutdownMargin)

    logger.info('Closing down metrics server')
    try {
      await new Promise(resolve => metricsServer.close(resolve))
    } catch (e) {
      logger.error(e)
    }
    logger.info('Closed metrics server')

    logger.info('Exiting program')
  })
}

main()
