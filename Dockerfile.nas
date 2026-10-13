# Obraz stacka Portainera "mcp-uodo" (NAS). Dockerfile z repo nie buduje sie: `npm ci` odpala `prepare` (build),
# zanim skopiowane sa zrodla - tu najpierw zaleznosci bez skryptow, potem zrodla i build. Zrodla bez zmian.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json build.mjs ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/http-server.js ./
USER 1029:100
EXPOSE 3000
ENV PORT=3000
CMD ["node", "http-server.js"]
