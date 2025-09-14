FROM node:18-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

COPY . .

RUN mkdir -p /usr/src/app/cache

ENV PORT 8080
EXPOSE 8080
CMD [ "node", "server.js" ]
