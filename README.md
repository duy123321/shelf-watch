# shelf-watch

A React SPA and a Fastify API for tracking what people are reading.

| Layer    | Stack                                          |
| -------- | ---------------------------------------------- |
| Frontend | React 19 + Vite 7 + React Router 7 (SPA)       |
| Backend  | Fastify 5 (Node 24, TypeScript, ESM)           |
| ORM      | Drizzle ORM + node-postgres                    |
| Database | PostgreSQL 17 (Docker locally, managed in prod)|

---

## Quick start

From a fresh clone, in order:

```bash
npm install
```

```bash
npm run build:shared
```

```bash
npm run db:up
```

```bash
npm run db:migrate && npm run db:seed
```

Then two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open **http://localhost:5173**. Try `/shelf/duy`, `/shelf/priya`, `/shelf/sam`, and `/shelf/nobody`.

> **`npm run build:shared` is not optional on a fresh clone.** `@shelf-watch/shared` exports `READ_STATUSES`, a runtime value, so it must compile to real JS before either project can import it. Skipping it fails with `Cannot find module '@shelf-watch/shared'`.

---

## Project structure

Three npm workspaces under a thin root. The root `package.json` has **no dependencies** — it only declares the workspaces and holds convenience scripts. There is one lockfile, at the root.

```
shelf-watch/
├── package.json              # workspaces + scripts only
├── package-lock.json         # single lockfile for all three
├── docker-compose.yml        # local Postgres 17
│
├── shelf-shared/             # @shelf-watch/shared — the API contract
│   └── src/index.ts          # READ_STATUSES, Shelf, ShelfBook, User, ...
│
├── shelf-api/                # Fastify API
│   ├── drizzle/              # generated SQL migrations (committed)
│   ├── drizzle.config.ts
│   ├── test/routes/          # vitest, via app.inject()
│   └── src/
│       ├── server.ts         # entrypoint — listen, signal handling
│       ├── app.ts            # buildApp() — autoloads plugins + routes
│       ├── config/env.ts     # zod-validated environment
│       ├── plugins/          # AUTOLOADED, all fastify-plugin wrapped
│       │   ├── cors.ts
│       │   ├── db.ts         # decorates app.db, drains pool on close
│       │   └── error-handler.ts
│       ├── routes/           # AUTOLOADED — directory path = URL prefix
│       │   ├── health/index.ts        → /health
│       │   └── api/users/index.ts     → /api/users
│       ├── db/
│       │   ├── schema.ts     # Drizzle tables + ReadStatus enum
│       │   ├── client.ts     # pg Pool + drizzle instance
│       │   ├── seed.ts
│       │   └── reset.ts      # drops the schema; refuses non-local URLs
│       └── services/users.ts # the query layer
│
└── shelf-web-client/         # React SPA
    ├── vite.config.ts        # proxies /api → localhost:3001
    └── src/
        ├── main.tsx
        ├── App.tsx           # routes
        ├── pages/            # Home, Shelf, NotFound
        ├── components/       # BookList, StatusCounts
        └── services/api.ts   # fetch wrapper + ApiError
```

### Why the workspace root exists

Purely so `@shelf-watch/shared` is importable from both projects without publishing it to a registry. npm symlinks `shelf-shared/` into each project's `node_modules/@shelf-watch/`. The two projects otherwise stay independent — separate frameworks, separate configs, separately deployable.

The tradeoff: one lockfile shared by all three, and platform builds install everything. See [Deployment](#deployment).

---

## Scripts

Run these from the repo root.

| Command                | What it does                                            |
| ---------------------- | ------------------------------------------------------- |
| `npm run build:shared` | Compile the contract package. Required before first run.|
| `npm run dev:shared`   | tsc watch — run while editing the contract.             |
| `npm run dev:api`      | API with hot reload on :3001                            |
| `npm run dev:web`      | Vite dev server on :5173                                |
| `npm run build`        | Production build of both projects                       |
| `npm test`             | API test suite (needs Postgres + seed)                  |
| `npm run db:up`        | Start Postgres                                          |
| `npm run db:down`      | Stop Postgres                                           |
| `npm run db:migrate`   | Apply pending migrations                                |
| `npm run db:seed`      | Seed fixtures (idempotent)                              |
| `npm run db:reset`     | Drop everything, migrate, reseed                        |

Inside `shelf-api/` there is also `npm run db:generate` (write a new migration after changing `schema.ts`) and `npm run db:studio`.

---

## Testing

```bash
npm run db:up && npm run db:reset && npm test
```

14 tests, driven through Fastify's `app.inject()` — no port binding. They run against the real local Postgres and the seed fixtures, so **reset the database first**; the suite creates users and would otherwise accumulate rows.

The suite pins the behaviours that were easiest to lose in the migration:

- `countsByStatus` zero-fills all four statuses
- `/books` returns a bare array, not `{ books: [...] }`
- `totalBooks` is a number, not a string (Postgres `COUNT()` is `bigint`)
- Both 404 paths return `{ "error": "User not found" }`
- An empty shelf is distinguishable from a missing user
- Books order by `updatedAt DESC`
- `readStatus.enumValues` still equals `READ_STATUSES`

### Manual check

With the API running:

```bash
curl -s localhost:3001/api/users/duy | jq
```

```bash
curl -s -w '\n%{http_code}\n' localhost:3001/api/users/nobody
```

### Seed fixtures

| User     | Shelf                             | Exercises                        |
| -------- | --------------------------------- | -------------------------------- |
| `duy`    | 4 books, one per status           | Full counts, ordering            |
| `priya`  | 2 books, both `READING`           | Zero-fill for the other three    |
| `sam`    | No books                          | Empty shelf ≠ missing user       |
| `nobody` | Never seeded                      | The 404 path                     |

---

## API

Base URL `http://localhost:3001`. Every error response is `{ "error": string }`.

| Method | Path                         | Success                                    |
| ------ | ---------------------------- | ------------------------------------------ |
| GET    | `/health`                    | `200 {"status":"ok"}`                      |
| GET    | `/api/users`                 | `200 User[]`                               |
| POST   | `/api/users`                 | `201 User` · `400` invalid · `409` taken   |
| GET    | `/api/users/:username`       | `200 ShelfSummary` · `404`                 |
| GET    | `/api/users/:username/books` | `200 ShelfBook[]` (bare array) · `404`     |

Types live in `shelf-shared/src/index.ts` and are imported by both projects.

Two contract details worth not breaking: `countsByStatus` always contains all four statuses (a status with no rows is `0`, never absent), and `/books` returns the array itself rather than wrapping it in an object.

---

## Database

Local Postgres runs in Docker (`docker-compose.yml`), exposed on `5432`:

```
postgres://shelfwatch:shelfwatch@localhost:5432/shelfwatch
```

Three tables — `User`, `Book`, `UserRead` — plus a `ReadStatus` enum type. Names are quoted PascalCase/camelCase, inherited from the original Prisma schema and deliberately preserved.

Changing the schema:

```bash
cd shelf-api && npm run db:generate && npm run db:migrate
```

Always `generate` + `migrate`, never `drizzle-kit push` — push keeps no migration history, which you want on a hosted database. Commit `shelf-api/drizzle/`.

---

## Deployment

Two services on Railway or Render. **Both build from the repo root**, not from their own subdirectory — workspace resolution needs the root lockfile. Pointing a service at `shelf-api/` will fail with "no lockfile found".

### API

| Setting      | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Root dir     | repo root                                                    |
| Build        | `npm ci && npm run build -w shelf-api`                       |
| Start        | `npm run db:migrate -w shelf-api && node shelf-api/dist/server.js` |
| Health check | `/health`                                                    |

Environment: `DATABASE_URL` (from the managed Postgres addon), `NODE_ENV=production`, `CORS_ORIGIN` (the frontend's exact origin — scheme + host, no trailing slash). `PORT` is injected by the platform; the server reads it and binds `0.0.0.0`.

Running migrations in the start command is fine for one instance. Past one, move it to a release command so concurrent boots don't race.

### Web

| Setting     | Value                                          |
| ----------- | ---------------------------------------------- |
| Root dir    | repo root                                      |
| Build       | `npm ci && npm run build -w shelf-web-client`  |
| Publish dir | `shelf-web-client/dist`                        |

Set `VITE_API_URL` to the API's origin **at build time** — Vite inlines `import.meta.env`, so changing it later needs a rebuild, not a restart.

**Add an SPA rewrite** (`/*` → `/index.html`) or a hard refresh on `/shelf/duy` will 404.

---

## Notes

Migrated from Next.js 16 (App Router + Prisma + SQLite). The full plan, including the schema translation and the defects found in the original code, is in [MIGRATION_PLAN.md](MIGRATION_PLAN.md). Agent-facing conventions are in [AGENTS.md](AGENTS.md).
