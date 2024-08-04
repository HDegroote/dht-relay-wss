const idEnc = require('hypercore-id-encoding')
const DhtPromClient = require('dht-prom-client')

function setupDhtPromClient (dht, promClient, logger, { prometheusAlias, prometheusSharedSecret, prometheusScraperPublicKey, prometheusServiceName }) {
  const dhtPromClient = new DhtPromClient(
    dht,
    promClient,
    prometheusScraperPublicKey,
    prometheusAlias,
    prometheusSharedSecret,
    prometheusServiceName
  )

  setupPromRpcClientLogging(dhtPromClient, logger)

  return dhtPromClient
}

function setupPromRpcClientLogging (client, logger) {
  client.on('register-alias-success', ({ updated }) => {
    logger.info(`Prom client successfully registered alias (updated: ${updated})`)
  })
  client.on('register-alias-error', (error) => {
    logger.info(`Prom client failed to register alias ${error.stack}`)
  })

  client.on('connection-open', ({ uid, remotePublicKey }) => {
    logger.info(`Prom client opened connection to ${idEnc.normalize(remotePublicKey)} (uid: ${uid})`)
  })
  client.on('connection-close', ({ uid, remotePublicKey }) => {
    logger.info(`Prom client closed connection to ${idEnc.normalize(remotePublicKey)} (uid: ${uid})`)
  })
  client.on('connection-error', ({ error, uid, remotePublicKey }) => {
    logger.info(`Prom client error on connection to ${idEnc.normalize(remotePublicKey)}: ${error.stack} (uid: ${uid})`)
  })

  client.on('metrics-request', ({ uid, remotePublicKey }) => {
    logger.debug(`Prom client received metrics request from ${idEnc.normalize(remotePublicKey)} (uid: ${uid})`)
  })
  client.on('metrics-error', ({ uid, error }) => {
    logger.debug(`Prom client failed to process metrics request: ${error} (uid: ${uid})`)
  })
  client.on('metrics-success', ({ uid }) => {
    logger.debug(`Prom client successfully processed metrics request (uid: ${uid})`)
  })
}

module.exports = setupDhtPromClient
