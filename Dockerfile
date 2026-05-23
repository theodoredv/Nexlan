FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache ffmpeg

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 34567

VOLUME ["/app/data", "/app/uploads", "/app/chunks", "/app/thumbnails", "/app/logs"]

ENV NODE_ENV=production
ENV PORT=34567
ENV UPLOAD_LIMIT=10mb

CMD ["npx", "tsx", "api/server.ts"]
