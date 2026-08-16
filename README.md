# Wechsel

A small internal web app for one team (3-20 people): post a PR that needs review
and/or acceptance testing, teammates volunteer for the roles, and a leaderboard
makes the invisible work of reviewing visible.

- **Stack:** TypeScript (strict), Hono, SQLite via Drizzle ORM, React 19 +
  Vite, Tailwind CSS v4, shadcn/ui, TanStack Query.
- **Platforms:** Runs on Cloudflare Workers (D1 database) or Node.js (file-based
  SQLite). Same code, same schema, different entry points.
- **Docs:** [architecture](docs/architecture.md), [product](docs/product.md),
  [implementation plan](docs/implementation-plan.md).

## Security warning

**There is no authentication.** Anyone who can reach the app can act as anyone,
delete any PR post, or remove any member. That is acceptable only because this is
an internal tool on a trusted network. Do not expose it to the internet. See
[`docs/architecture.md#12-security-posture`](docs/architecture.md) for the full
posture and the migration path if that ever changes.

## Prerequisites

- Node.js 22 LTS
- pnpm 10 (`corepack enable` or `npm i -g pnpm@10`)

## Setup

```sh
pnpm install
```

## Choose your platform

Wechsel runs on two platforms. Pick the one that fits your deployment:

| | Cloudflare Workers | Node.js (VPS / local) |
|---|---|---|
| **Database** | D1 (managed SQLite) | File-based SQLite (`./data/app.db`) |
| **Dev command** | `pnpm dev` | `pnpm dev:node` |
| **Prod command** | `wrangler deploy` | `pnpm start:node` |
| **Migrations** | `wrangler d1 execute` (manual) | Auto-run on startup |

## Commands

### Development

| Script            | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Vite + Cloudflare workerd with HMR (for Cloudflare deployment)    |
| `pnpm dev:node`   | Node.js server on `:8787` with auto-reload (for VPS / local)      |

### Build and run

| Script              | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm build`        | Builds client assets to `dist/`                                   |
| `pnpm start:node`   | Runs the production Node.js server (migrations + static files)    |
| `pnpm preview`      | Previews Cloudflare production build locally via wrangler         |

### Database

| Script               | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `pnpm db:generate`   | Generate a new migration from `src/server/db/schema.ts`           |
| `pnpm db:migrate:local`  | Apply D1 migrations locally (Cloudflare only)                |
| `pnpm db:migrate:remote` | Apply D1 migrations to production (Cloudflare only)           |
| `pnpm db:seed:local` | Seed demo data into the local database                            |

### Quality

| Script            | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm typecheck`  | `tsc --noEmit` for client and server                              |
| `pnpm test`       | Vitest                                                            |
| `pnpm lint`       | ESLint                                                            |

## Run in production locally (Node.js)

The simplest way to run the app on a single machine:

```sh
pnpm install
pnpm build
pnpm start:node
```

The server starts on `http://localhost:8787`. Migrations run automatically on
startup. The SQLite database is created at `./data/app.db`.

### Configuration

All variables are optional; defaults are shown:

| Variable      | Default           | Purpose                             |
| ------------- | ----------------- | ----------------------------------- |
| `PORT`        | `8787`            | HTTP port                           |
| `DB_FILE`     | `./data/app.db`   | SQLite database file                |

There are no secrets, so no `.env` is required. `.env.example` documents the
knobs.

## Run on a VPS

### systemd

Install the built app somewhere like `/opt/wechsel` (`pnpm install && pnpm build`
inside it), create a dedicated user, and add:

```ini
[Unit]
Description=Wechsel
After=network.target

[Service]
Type=simple
User=wechsel
WorkingDirectory=/opt/wechsel
ExecStart=/usr/bin/node dist/server/server/platforms/node.js
Environment=PORT=8787
Environment=DB_FILE=/opt/wechsel/data/app.db
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Then `systemctl enable --now wechsel`.

### pm2

```sh
pm2 start dist/server/server/platforms/node.js --name wechsel --cwd /opt/wechsel
pm2 save
pm2 startup   # follow the printed command so it survives reboots
```

### Docker

Build and run with the database on a mounted volume so it survives container
replacements:

```sh
docker build -t wechsel .
docker run -d --name wechsel -p 8787:8787 -v "$PWD/data:/app/data" wechsel
```

The container stores the database at `/app/data/app.db`. Back it up by copying
that volume exactly as described above.

## The database

The SQLite database lives at `data/app.db` (default), with WAL sidecar files
`data/app.db-shm` and `data/app.db-wal` next to it. `data/` is gitignored.

**Back up:** the simplest safe option is to stop the app and copy the file:

```sh
cp data/app.db* /somewhere/safe/
```

For a consistent snapshot while the app is running, use the sqlite3 CLI
(`sqlite3 data/app.db ".backup 'wechsel-backup.db'"`). Copying just `app.db`
while the app is running is not reliable because WAL may hold recent writes.

**Restore:** stop the app, replace the file (delete stale `-shm`/`-wal`
sidecars), and start again:

```sh
cp /somewhere/safe/app.db data/app.db
rm -f data/app.db-shm data/app.db-wal
pnpm start:node
```

Nothing except deleting a PR is ever truly destroyed at the database level, and
the file is trivially copyable, so nightly `cron` copies of `data/app.db` are a
complete backup strategy.

## Cloudflare Workers deployment

```sh
wrangler login
wrangler d1 migrations apply wechsel-db --remote
wrangler deploy
```

The Cloudflare deployment uses D1 for the database. Static assets are served
via Workers Assets. See `wrangler.jsonc` for the D1 binding configuration.

## Layout

```text
src/
├── shared/    imported by BOTH client and server (schemas, types, helpers)
├── server/
│   ├── app.ts                 Hono app (platform-agnostic)
│   ├── platforms/             entry points (one per deployment target)
│   │   ├── cloudflare.ts      Cloudflare Workers adapter
│   │   └── node.ts            Node.js adapter
│   ├── services/              business rules + permissions
│   ├── db/                    schema, migrations, connection factories
│   └── middleware/            actor resolution
└── client/    React app (Vite root)
```

`@` aliases `src/client`, `@shared` aliases `src/shared`, `@server` aliases
`src/server` in the client.
