# Wechsel

A small internal web app for one team: post a PR that needs review and/or acceptance
testing, teammates volunteer for the roles, and a leaderboard makes the work visible.

Docs live in [`docs/`](docs/architecture.md) (architecture) and
[`docs/implementation-plan.md`](docs/implementation-plan.md) (phased plan).

## Stack

TypeScript (strict), Hono + `@hono/node-server`, SQLite via Drizzle ORM, React 19 +
Vite, Tailwind CSS v4, shadcn/ui, TanStack Query. See `docs/architecture.md`.

## Prerequisites

- Node.js 22 LTS
- pnpm 10

## Setup

```sh
pnpm install
```

## Commands

| Script            | What it does                                                     |
| ----------------- | ---------------------------------------------------------------- |
| `pnpm dev`        | Vite on `5173` + Hono API on `8787` (via `tsx watch`), together  |
| `pnpm build`      | Client to `dist/client`, server to `dist/server`                 |
| `pnpm start`      | Run the built server (migrations first from phase 1 on)          |
| `pnpm typecheck`  | `tsc --noEmit` for client and server projects                    |
| `pnpm test`       | Vitest                                                           |
| `pnpm lint`       | ESLint                                                           |

## Layout

```text
src/
├── shared/    imported by BOTH client and server (schemas, types, helpers)
├── server/    Hono app, services, db
└── client/    React app (Vite root)
```

`@` aliases `src/client`, `@shared` aliases `src/shared`, `@server` aliases
`src/server` in the client.
