# DHT-Relay WSS

Websocket server for the Hyperswarm DHT Relay, with some minimal instrumentation (`/health` and `/metrics` endpoints).

Warning: still in alfa, breaking changes possible till v1 release.

Note also that [hyperswarm-dht-relay](https://github.com/holepunchto/hyperswarm-dht-relay) is still marked as experimental.

## Install

`npm i -g dht-relay-wss`

## Usage
Note: can be run as Docker, see [here](https://hub.docker.com/repository/docker/hdegroote/dht-relay-wss)

The global install exposes a script you can run with

```dht-relay-wss```

By default, the logs are in JSON format.
If you would like them to be human-readable, pipe them into pino-pretty (which needs to be installed):

`dht-relay-wss | pino-pretty`

When deploying, you will typically want to run this behind a reverse-proxy which terminates the wss (websocket secure) connection.

## Endpoints

Listens for websocket connections at `/`

In addition, has the following http endpoints:

#### ```GET /health```

Returns a 200 status if healthy, or 503 otherwise.

#### ```GET /metrics```

Returns metrics in Prometheus format

## Options

Options are specified either in a .env file or as environment variables. They include:

```
  WS_PORT=8080,
  DHT_PORT,
  DHT_HOST='0.0.0.0',
  LOG_LEVEL='info',
  HOST='127.0.0.1',
  S_SHUTDOWN_MARGIN=10
```

