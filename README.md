# Wechsel

A small internal web app for one team (3-20 people): post a PR that needs review
and/or acceptance testing, teammates volunteer for the roles, and a leaderboard
makes the invisible work of reviewing visible.

- **Stack:** TypeScript (strict), Hono + `@hono/node-server`, SQLite via Drizzle
  ORM, React 19 + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query.
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

Run migrations against a fresh database (also done automatically by `pnpm start`):

```sh
pnpm db:migrate
```

Optionally load demo data:

```sh
pnpm db:seed
```

## Commands

| Script            | What it does                                                      |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm dev`        | Vite on `5173` + Hono API on `8787` (via `tsx watch`), together   |
| `pnpm build`      | Client to `dist/client`, server to `dist/server`                  |
| `pnpm start`      | Run the built server (migrations first), serves UI + `/api`       |
| `pnpm typecheck`  | `tsc --noEmit` for client and server projects                     |
| `pnpm test`       | Vitest                                                            |
| `pnpm lint`       | ESLint                                                            |
| `pnpm db:generate`| Create a new migration from `src/server/db/schema.ts`             |
| `pnpm db:migrate` | Apply pending migrations in `drizzle/`                            |
| `pnpm db:seed`    | Load demo members and PRs                                         |

## Run in production

```sh
pnpm build
pnpm start
```

`pnpm start` runs pending migrations, then serves both the API (`/api`) and the
built client (`dist/client`) from one process. The default port is `8787`; the
app is reachable at `http://localhost:8787`.

## Configuration

All variables are optional; defaults are shown:

| Variable      | Default           | Purpose                             |
| ------------- | ----------------- | ----------------------------------- |
| `PORT`        | `8787`            | HTTP port                           |
| `DB_FILE`     | `./data/app.db`   | SQLite database file                |
| `STATIC_DIR`  | `./dist/client`   | Built client assets (SPA served)    |

There are no secrets, so no `.env` is required. `.env.example` documents the
knobs.

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
pnpm start
```

Nothing except deleting a PR is ever truly destroyed at the database level, and
the file is trivially copyable, so nightly `cron` copies of `data/app.db` are a
complete backup strategy.

## Run on a small internal box

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
ExecStart=/usr/bin/node dist/server/server/index.js
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
pm2 start dist/server/server/index.js --name wechsel --cwd /opt/wechsel
pm2 save
pm2 startup   # follow the printed command so it survives reboots
```

## Docker

A production image is defined in `Dockerfile`. Build and run with the database on
a mounted volume so it survives container replacements:

```sh
docker build -t wechsel .
docker run -d --name wechsel -p 8787:8787 -v "$PWD/data:/app/data" wechsel
```

The container stores the database at `/app/data/app.db` (`DB_FILE` is set inside
the image); back it up by copying that volume exactly as described above.

## Layout

```text
src/
├── shared/    imported by BOTH client and server (schemas, types, helpers)
├── server/    Hono app, services, db
└── client/    React app (Vite root)
```

`@` aliases `src/client`, `@shared` aliases `src/shared`, `@server` aliases
`src/server` in the client.
