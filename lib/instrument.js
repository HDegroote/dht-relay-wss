const metricsPlugin = require('fastify-metrics')

function setupHealthEndpoint (app) {
  app.get('/health', { logLevel: 'warn' }, function (req, reply) {
    reply.status(200)
    reply.send('Healthy')
  })
}

function instrument (dhtRelay) {
  setupHealthEndpoint(dhtRelay.app)

  dhtRelay.app.register(metricsPlugin, {
    defaultMetrics: { enabled: false }, // We manage these ourselves
    endpoint: '/metrics',
    routeMetrics: {
      routeBlacklist: ['/health', '/metrics']
    }
  })
}

module.exports = instrument
