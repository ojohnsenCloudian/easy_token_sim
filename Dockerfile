# ─── Stage 1: Build Next.js ───────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /build

COPY webapp/package*.json ./
RUN npm ci --prefer-offline

# Install openssl so Prisma can detect the system version and load correctly
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY webapp/ ./

# Generate Prisma client
RUN DATABASE_URL="file:/tmp/build.db" npx prisma generate

# Build Next.js in standalone mode
RUN DATABASE_URL="file:/tmp/build.db" npm run build

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# Install Java (for cloudian-token-test), Python 3 (for simulate_add_node.py)
RUN apt-get update && apt-get install -y --no-install-recommends \
    default-jre-headless \
    python3 \
    python3-pip \
    openssl \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages pyyaml

# ── Simulator ────────────────────────────────────────────────────────────────
COPY expansion-simulator/ /app/expansion-simulator/
RUN chmod +x /app/expansion-simulator/cloudian-token-test \
             /app/expansion-simulator/cloudian-token-gen

COPY run_customer.py /app/run_customer.py

# ── Next.js standalone output ────────────────────────────────────────────────
COPY --from=builder /build/.next/standalone /app/webapp/
COPY --from=builder /build/.next/static     /app/webapp/.next/static
COPY --from=builder /build/public           /app/webapp/public

# Prisma generated client (query engine + JS client) + CLI for migrations
COPY --from=builder /build/node_modules/.prisma  /app/webapp/node_modules/.prisma
COPY --from=builder /build/node_modules/@prisma  /app/webapp/node_modules/@prisma
COPY --from=builder /build/node_modules/prisma   /app/webapp/node_modules/prisma
COPY --from=builder /build/node_modules/.bin/prisma /app/webapp/node_modules/.bin/prisma

# Prisma schema + migrations so `prisma migrate deploy` can run at startup
COPY webapp/prisma /app/webapp/prisma

COPY entrypoint.sh /app/webapp/entrypoint.sh
RUN chmod +x /app/webapp/entrypoint.sh

WORKDIR /app/webapp

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV DATABASE_URL="file:/data/db.sqlite"
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["/app/webapp/entrypoint.sh"]
