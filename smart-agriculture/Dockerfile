FROM docker.1ms.run/library/node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci

COPY . .
RUN npm run build

FROM docker.1ms.run/library/node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/models ./models
COPY --from=builder /app/database.sql ./
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/data /app/uploads && \
    groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs nextjs && \
    chown -R nextjs:nodejs /app/data /app/uploads

VOLUME ["/app/data", "/app/uploads"]

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npx", "next", "start"]
