# DHT-Relay WSS

Websocket server for the DHT Relay, with some minimal instrumentation (`/health` and `/metrics` endpoints)

## Install

`npm i -g dht-relay-wss`

## Usage

The global install exposes a script you can run with

```dht-relay-wss```

By default, the logs are in JSON format.
If you wish them to be human-readable, pipe them into pino-pretty (which needs to be installed):

`dht-relay-wss | pino-pretty`

## Endpoints

Listens for websocket connections at `/`

In addition, has the following http endpoint:

#### ```GET /health```

Returns a 200 status if healthy, or 503 otherwise.

#### ```GET /metrics```

Returns metrics in Prometheus format

## Options

Options are specified either in a .env file or as environment variables. They include:

```
  wsPort=8080,
  dhtPort,
  logLevel='info',
  host='127.0.0.1',
  sShutdownMargin=10
```

