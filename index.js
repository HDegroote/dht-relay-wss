const { relay } = require('@hyperswarm/dht-relay')
const Stream = require('@hyperswarm/dht-relay/ws')
const safetyCatch = require('safety-catch')

const websocketPlugin = require('@fastify/websocket')
const ReadyResource = require('ready-resource')

class DhtRelayWss extends ReadyResource {
  constructor (app, dht, { sShutdownMargin = 5, wsPort = 0, wsHost = 'localhost' } = {}) {
    super()

    this.app = app
    this.dht = dht

    this.wsPort = wsPort
    this.wsHost = wsHost
    this.sShutdownMargin = sShutdownMargin

    this.httpAddress = null
    this.wsAddress = null

    this._setupWsServer()
  }

  async _open () {
    await this.dht.ready()
    this.httpAddress = await this.app.listen({
      port: this.wsPort,
      host: this.wsHost
    })
    this.wsAddress = this.httpAddress.replace('http', 'ws')
  }

  async _close () {
    await this.app.close()
    await this.dht.destroy()
  }

  _setupWsServer () {
    // hack to pass our scope on to closeWssServerConnections
    // (fastify forces a new scope when registering a plugin)
    const self = this

    this.app.register(websocketPlugin, {
      preClose: async function wssPreClose () {
        await closeWsServerConnections(this.websocketServer, self)
      },
      options: {
        clientTracking: true
      },
      connectionOptions: {
        readableObjectMode: true // See https://github.com/fastify/fastify-websocket/issues/185
      }
    })

    this.app.register(async (app) => {
      app.get('/', { websocket: true }, this._connHandler.bind(this))
    })
  }

  async _connHandler (connection, req) {
    const socket = connection.socket
    const ip = req.socket.remoteAddress
    const port = req.socket.remotePort
    const id = `${ip}:${port}`

    socket.on('error', (error) => {
      this.emit('conn-error', { id, error })
    })

    socket.on('close', () => {
      this.emit('conn-close', { id })
    })

    relay(this.dht, new Stream(false, socket))
    this.emit('conn-open', { id })

    socket.send('You are being relayed')
  }
}

async function closeWsServerConnections (wsServer, dhtRelay) {
  const sShutdownMargin = dhtRelay.sShutdownMargin

  const closeProm = new Promise(resolve => wsServer.close(resolve))
  closeProm.catch(safetyCatch)

  dhtRelay.emit('ws-closing-signal', { nrClients: wsServer.clients.size, sShutdownMargin })
  if (wsServer.clients.size > 0 && sShutdownMargin > 0) {
    for (const socket of wsServer.clients) {
      socket.send(`Server closing. Socket will shut down in ${sShutdownMargin}s`)
    }
  }

  let timeout = null
  let resolveTimeoutProm = null
  const timeoutProm = new Promise(resolve => {
    resolveTimeoutProm = resolve
    timeout = setTimeout(resolve, sShutdownMargin * 1000)
  })

  await Promise.race([
    timeoutProm,
    closeProm // If all connections close before the timeout
  ])

  clearTimeout(timeout)
  resolveTimeoutProm()

  const nrRemainingClients = wsServer.clients.size
  if (nrRemainingClients) {
    dhtRelay.emit('ws-closing-force', ({ nrRemainingClients }))

    const goingAwayCode = 1001
    for (const socket of wsServer.clients) {
      socket.close(goingAwayCode, 'Server is going offline')
    }
  }

  dhtRelay.emit('ws-closing-done')
}

module.exports = DhtRelayWss
