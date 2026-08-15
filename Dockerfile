# Wechsel - production image

# --- build stage ------------------------------------------------------------
FROM node:22-bookworm-slim AS build

# better-sqlite3 is a native module; keep the build toolchain in this stage.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm@10.6.2

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# --- runtime stage -----------------------------------------------------------
# No toolchain needed; node_modules (including the compiled better-sqlite3
# binary) is copied from the build stage so it matches this image.
FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./package.json

ENV PORT=8787
ENV DB_FILE=/app/data/app.db

# Mount a volume here to keep the database across container replacements:
#   docker run -v "$PWD/data:/app/data" ...
EXPOSE 8787

CMD ["node", "dist/server/server/index.js"]
