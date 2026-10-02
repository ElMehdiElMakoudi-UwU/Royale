FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
# Seed script + its deps, for the one-time `docker compose run --rm app npm run seed`.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src/db ./src/db
COPY --from=build /app/package.json ./package.json
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
