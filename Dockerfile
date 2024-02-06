FROM node:20-slim

RUN apt update && apt install curl -y

RUN useradd --create-home relayer
USER relayer

COPY package-lock.json /home/relayer/
COPY node_modules /home/relayer/node_modules
COPY package.json /home/relayer/
COPY run.js /home/relayer/
COPY index.js /home/relayer/
COPY LICENSE /home/relayer/
COPY NOTICE /home/relayer/


ENV WS_PORT=8080
ENV DHT_PORT=48200
ENV LOG_LEVEL=info
ENV HOST=0.0.0.0
ENV DHT_HOST=0.0.0.0
ENV S_SHUTDOWN_MARGIN=5

HEALTHCHECK --retries=1 --timeout=5s CMD curl --fail http://localhost:8080/health

ENTRYPOINT ["node", "/home/relayer/run.js"]
