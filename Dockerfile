FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist/http-server.js ./
EXPOSE 3000
ENV PORT=3000
CMD ["node", "http-server.js"]
