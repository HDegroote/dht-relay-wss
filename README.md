# DHT-Relay WSS

Websocket server for the Hyperswarm DHT Relay, with some minimal instrumentation (`/health` and `/metrics` endpoints).

Note that [hyperswarm-dht-relay](https://github.com/holepunchto/hyperswarm-dht-relay) is still marked as experimental.

## Install

`npm i -g dht-relay-wss`

## Usage
Note: can be run as Docker, see [here](https://hub.docker.com/r/hdegroote/dht-relay-wss/)

The global install exposes a script you can run with

```dht-relay-wss```

By default, the logs are in JSON format.
If you would like them to be human-readable, pipe them into pino-pretty (which needs to be installed):

`dht-relay-wss | pino-pretty`

When deploying, you will typically want to run this behind a https reverse-proxy which terminates the wss (websocket secure) connection.

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
  DHT_RELAY_WS_PORT=8080,
  DHT_RELAY_DHT_PORT,
  DHT_RELAY_LOG_LEVEL='info',
  DHT_RELAY_HTTP_HOST='127.0.0.1',
  DHT_RELAY_S_SHUTDOWN_MARGIN=10
```
