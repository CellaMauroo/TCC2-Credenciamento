# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
# A CA opcional só é necessária em ambientes com proxy corporativo.
RUN --mount=type=secret,id=proxy_ca,required=false \
    if [ -f /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci --strict-ssl=true; else npm ci --strict-ssl=true; fi
COPY . .
RUN npm run build && npm prune --omit=dev
FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
CMD ["npm","start"]
