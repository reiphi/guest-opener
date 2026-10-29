FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# The runtime image only holds the single bundled file: no node_modules, no build tools.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY --from=build /app/dist/server.mjs ./
EXPOSE 8787
CMD ["node", "server.mjs"]
