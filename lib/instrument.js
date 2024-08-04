const metricsPlugin = require('fastify-metrics')

function setupHealthEndpoint (dhtRelay) {
  dhtRelay.app.get('/health', { logLevel: 'warn' }, function (req, reply) {
    if (dhtRelay.opened !== true) {
      reply.status(503)
      reply.send('Service not yet ready')
    } else if (dhtRelay.closing) {
      reply.status(503)
      reply.send('Service shutting down')
    } else {
      reply.status(200)
      reply.send('Service healthy')
    }
  })
}

function instrument (dhtRelay) {
  setupHealthEndpoint(dhtRelay)

  dhtRelay.app.register(metricsPlugin, {
    defaultMetrics: { enabled: false }, // We manage these ourselves
    endpoint: '/metrics',
    routeMetrics: {
      routeBlacklist: ['/health', '/metrics']
    }
  })
}

module.exports = instrument
