FROM node:20-slim

RUN apt update && apt install curl -y

# Can be changed
ENV DHT_RELAY_WS_PORT=8080

RUN useradd --create-home -u 42319 dht-relay-wss

COPY package-lock.json /home/dht-relay-wss/
COPY node_modules /home/dht-relay-wss/node_modules
COPY package.json /home/dht-relay-wss/
COPY run.js /home/dht-relay-wss/
COPY index.js /home/dht-relay-wss/
COPY lib/ home/dht-relay-wss/lib
COPY LICENSE /home/dht-relay-wss/
COPY NOTICE /home/dht-relay-wss/

USER dht-relay-wss
WORKDIR /home/dht-relay-wss/

HEALTHCHECK --retries=1 --timeout=5s CMD curl --fail http://localhost:${DHT_RELAY_WS_PORT}/health

ENTRYPOINT ["node", "/home/dht-relay-wss/run.js"]
