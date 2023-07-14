FROM node:18-slim
ARG TAG=passAsBuildArg

ENV WS_PORT=8080
ENV DHT_PORT=48200
ENV LOG_LEVEL=info
ENV HOST=0.0.0.0
ENV DHT_HOST=0.0.0.0
ENV S_SHUTDOWN_MARGIN=5

RUN npm i -g dht-relay-wss@${TAG}

RUN useradd --create-home relayer
USER relayer

ENTRYPOINT ["dht-relay-wss"]
