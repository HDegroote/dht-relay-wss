const DHT = require('@hyperswarm/dht-relay')
const Stream = require('@hyperswarm/dht-relay/ws')
const WebSocket = require('ws')
const Hyperswarm = require('hyperswarm')

async function getRelayedSwarm (url, t) {
  const socket = new WebSocket(url)

  const stream = new Stream(true, socket)
  // Unsure if this can happen
  stream.on('error', e => { console.log('ws stream error', e) })

  const dht = new DHT(stream)

  const swarm = new Hyperswarm({ dht })

  t.teardown(async () => {
    await swarm.destroy()
  })

  return swarm
}

module.exports = {
  getRelayedSwarm
}
