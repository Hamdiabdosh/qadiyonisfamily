# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .

ARG VITE_APP_URL=https://qadiyonis.space
ENV VITE_APP_URL=$VITE_APP_URL

RUN bun run build

# Production stage
FROM oven/bun:1 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV UPLOADS_DIR=/app/uploads

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/uploads

COPY --from=builder /app/package.json /app/bun.lock /app/bunfig.toml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/lib/auth.server.ts ./src/lib/auth.server.ts
COPY --from=builder /app/src/lib/lineage-compute.server.ts ./src/lib/lineage-compute.server.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["bun", "run", "scripts/docker-start.ts"]
