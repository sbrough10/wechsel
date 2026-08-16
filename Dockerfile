FROM node:22-slim AS build
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate
WORKDIR /app
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
RUN mkdir -p data
ENV PORT=8787
ENV DB_FILE=/app/data/app.db
EXPOSE 8787
CMD ["node", "dist/server/server/platforms/node.js"]
