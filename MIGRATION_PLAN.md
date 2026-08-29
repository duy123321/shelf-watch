# shelf-watch: Next.js → React SPA + Fastify API

> **Status: executed.** This migration was carried out on the `migrate-to-fastify-react` branch. See [README.md](README.md) for how to run and test the result. This document is kept as the design record and rationale.
>
> Four things differed from the plan as written; all are corrected inline below:
> 1. `drizzle.config.ts` has no `casing: "preserve"` — that value doesn't exist (§2.5).
> 2. Drizzle wraps driver errors, so the unique-violation code is on `err.cause.code` (§4.7).
> 3. Vitest needs a resolver alias plus `@fastify/autoload` inlined to handle NodeNext `.js` specifiers.
> 4. `db:reset` must drop the `drizzle` schema too, or the migration journal makes the following `migrate` a silent no-op.

Migration plan. Written to be executed by an agent with no prior context on this repo.

**Target stack**

| Layer     | From                          | To                                      |
| --------- | ----------------------------- | --------------------------------------- |
| Frontend  | Next.js App Router (RSC)      | React 19 + Vite + React Router (SPA)    |
| Backend   | Next.js Route Handlers        | Fastify 5 (Node 22, TypeScript, ESM)    |
| ORM       | Prisma 7 + better-sqlite3     | Drizzle ORM + node-postgres             |
| Database  | SQLite (`dev.db`)             | PostgreSQL (Docker local, managed prod) |
| Hosting   | —                             | Railway or Render, two services         |

**Ground rules for whoever implements this**

- The frontend is throwaway. Build the minimum React app that proves every endpoint works. Do not port `app/page.tsx` (create-next-app boilerplate) or replicate the shelf page's styling. Do not spend effort on design.
- The API contract and the database schema are the things being preserved. Get those exactly right.
- Delete Next.js entirely at the end. No `next` dependency, no `app/` directory, no `app/generated/prisma`.
- Node 22 LTS, ESM (`"type": "module"`), TypeScript strict.

---

## 0. Pre-flight: known defects in the current code

Resolve these deliberately during the migration rather than porting them forward.

### 0.1 Schema drift — `User.profilePicture`

`prisma/schema.prisma` declares:

```prisma
model User {
  id             Int      @id @default(autoincrement())
  username       String   @unique
  profilePicture String            // ← required, no default
  createdAt      DateTime @default(now())
  reads          UserRead[]
}
```

But no migration in `prisma/migrations/` ever adds `profilePicture`. `20260808174501_init` creates `User` with only `id`, `username`, `createdAt`. The live `dev.db` therefore has **no `profilePicture` column**.

**Verify before doing anything else:**

```bash
sqlite3 dev.db '.schema User'
```

**Decision (apply this unless told otherwise):** keep the column, make it nullable (`text("profilePicture")` with no `.notNull()`). A required-with-no-default column can't be backfilled for existing rows and forces every insert to supply an avatar URL that the app has no source for yet. Nullable now, tighten later once there's an upload/default-avatar story.

### 0.2 `POST /api/users` cannot succeed against the declared schema

`app/api/users/route.ts` does `prisma.user.create({ data: { username } })`. With `profilePicture` required, Prisma rejects this at the type level and the DB rejects it at runtime. It only "works" today because the real table lacks the column. Making `profilePicture` nullable (0.1) fixes this.

### 0.3 No input validation anywhere

`POST /api/users` does `await request.json()` and destructures `username` with no checks. A body of `{}` yields `username: undefined` → a driver-level error → 500. A duplicate username → unhandled unique-constraint violation → 500. Fix during the port (§4.4, §4.6).

### 0.4 `Book.covers` / `UserRead.cover` / `Book.defaultCover` are unused

Added in `20260809040520_add_book_covers` but read by no code path. Carry them into the Drizzle schema unchanged — they're real columns with real data semantics — but no endpoint needs to return them yet.

### 0.5 `dev.db` is committed to the repo

40KB SQLite file tracked in git. It holds nothing worth keeping (§3), so delete it outright in Phase 5: `git rm --cached dev.db`, delete the file, and add `*.db` to `.gitignore`.

---

## 1. Target repository layout

**Three npm workspaces under a thin root.** `shelf-api` and `shelf-web-client` stay separate projects with their own `package.json`, own `tsconfig.json`, own `.env`, and their own conventional framework structure — `fastify-cli`-style autoloaded plugins and routes for the API, `create-vite` React-TS layout for the client. A third workspace, `shelf-shared`, holds the API contract types both consume.

The root `package.json` exists only to declare the workspaces and hold convenience scripts. It has no dependencies and no source. There is **one lockfile**, at the root — that's the mechanism that makes `@shelf-watch/shared` resolvable from both projects without publishing it anywhere.

```
shelf-watch/
├── package.json                 # workspaces + scripts ONLY, no deps
├── package-lock.json            # single lockfile for all three
├── docker-compose.yml           # local Postgres
├── .gitignore
├── MIGRATION_PLAN.md
├── README.md                    # how to run everything
│
├── shelf-shared/                # ← @shelf-watch/shared
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts             # ReadStatus, Shelf, ShelfBook, User, ...
│
├── shelf-api/                   # ← Fastify project
│   ├── package.json
│   ├── tsconfig.json
│   ├── drizzle.config.ts
│   ├── .env
│   ├── .env.example
│   ├── drizzle/                 # generated SQL migrations (committed)
│   ├── test/
│   │   ├── helper.ts            # buildApp() harness for app.inject()
│   │   └── routes/
│   │       └── users.test.ts
│   └── src/
│       ├── server.ts            # entrypoint: listen, signal handling
│       ├── app.ts               # buildApp(): autoload plugins + routes
│       ├── config/
│       │   └── env.ts           # validated env
│       ├── plugins/             # AUTOLOADED — cross-cutting, fastify-plugin
│       │   ├── cors.ts
│       │   ├── db.ts            # decorates app.db
│       │   └── error-handler.ts
│       ├── routes/              # AUTOLOADED — directory path = URL prefix
│       │   ├── health/
│       │   │   └── index.ts     # → GET /health
│       │   └── api/
│       │       └── users/
│       │           └── index.ts # → /api/users, /api/users/:username, ...
│       ├── db/
│       │   ├── schema.ts        # Drizzle tables + enum
│       │   ├── client.ts        # pool + drizzle instance
│       │   └── seed.ts
│       └── services/
│           └── users.ts         # port of lib/services/users.ts
│
└── shelf-web-client/            # ← React project
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── index.html
    ├── .env
    ├── .env.example
    ├── public/
    └── src/
        ├── main.tsx             # createRoot + RouterProvider
        ├── App.tsx              # route definitions
        ├── index.css
        ├── vite-env.d.ts
        ├── assets/
        ├── components/
        │   ├── BookList.tsx
        │   └── StatusCounts.tsx
        ├── pages/
        │   ├── Home.tsx
        │   └── Shelf.tsx
        └── services/
            └── api.ts           # fetch wrapper + ApiError
```

Root `package.json`:

```json
{
  "name": "shelf-watch",
  "private": true,
  "workspaces": ["shelf-shared", "shelf-api", "shelf-web-client"],
  "scripts": {
    "build:shared": "npm run build -w @shelf-watch/shared",
    "dev:api": "npm run dev -w shelf-api",
    "dev:web": "npm run dev -w shelf-web-client",
    "db:up": "docker compose up -d",
    "db:reset": "npm run db:reset -w shelf-api"
  }
}
```

Both are standard layouts, so a model that knows Fastify or Vite/React will find things where it expects them. Two notes on the Fastify side, since autoloading is the part that's easy to get subtly wrong:

- **`plugins/` vs `routes/`** — anything in `plugins/` is cross-cutting and must be wrapped in `fastify-plugin` so its decorators escape the encapsulation context and are visible to routes. Anything in `routes/` must **not** be wrapped, so each route file keeps its own scope.
- **Directory path becomes the URL prefix.** `@fastify/autoload` with `dirNameRoutePrefix` derives `/api/users` from `routes/api/users/`. That's why the tree nests that way rather than a flat `routes/users.ts` — it reproduces the current `/api/*` paths without any manual `prefix` option.

**Running it locally** — `npm install` once at the root installs all three:

```bash
npm install                  # root — links @shelf-watch/shared into both projects
npm run build:shared         # required once before either project can start
docker compose up -d         # Postgres
npm run dev:api              # :3001
npm run dev:web              # :5173
```

**`build:shared` before first run is not optional.** `@shelf-watch/shared` exports a runtime value (`READ_STATUSES`), not just types, so it needs real JS output. See §4.9.

**Why a workspace root, given the projects are otherwise separate.** npm workspaces is what makes one package importable by another in the same repo without publishing to a registry — npm symlinks `shelf-shared/` into each project's `node_modules/@shelf-watch/shared`. The two projects stay structurally independent: separate directories, separate `package.json`, separate frameworks, separately deployable. What the root adds is a single lockfile and a resolution mechanism.

The costs are real but small, and worth naming so nobody is surprised:

- **One lockfile.** A dependency bump in one project touches a file the other also uses. In practice this is a merge-conflict annoyance, not a correctness problem.
- **Platform builds install everything.** Setting a service's root directory to `shelf-api` no longer works — workspace resolution needs the root lockfile, so both deploys build from the repo root and install all three projects' dependencies. §6 is written accordingly. It costs build time, not correctness.
- **Splitting into two repos later is no longer free** — it would mean publishing `@shelf-watch/shared` to a registry, or going back to duplication.

The alternative — `"@shelf-watch/shared": "file:../shelf-shared"` in each project with no workspace root — preserves per-project lockfiles and per-project deploy roots. It works, but `file:` dependencies are copied rather than symlinked by some npm versions, which means edits to the shared package don't appear until you reinstall. Workspaces are the better-supported path; use them.

---

## 2. Database schema

### 2.1 Source of truth (current SQLite, reconstructed from migrations)

```
User      id INTEGER PK AUTOINCREMENT
          username TEXT NOT NULL, UNIQUE INDEX User_username_key
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          [profilePicture — declared in schema.prisma, absent from DB. See §0.1]

Book      id INTEGER PK AUTOINCREMENT
          title TEXT NOT NULL
          author TEXT NOT NULL
          defaultCover TEXT NOT NULL
          covers JSONB NOT NULL
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP

UserRead  id INTEGER PK AUTOINCREMENT
          userId INTEGER NOT NULL → User(id) ON DELETE RESTRICT ON UPDATE CASCADE
          bookId INTEGER NOT NULL → Book(id) ON DELETE RESTRICT ON UPDATE CASCADE
          cover TEXT NOT NULL
          status TEXT NOT NULL          -- Prisma enum ReadStatus, stored as text
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          updatedAt DATETIME NOT NULL   -- Prisma @updatedAt, set by client not DB
          UNIQUE INDEX UserRead_userId_bookId_key (userId, bookId)

enum ReadStatus = TBR | READING | FINISHED | DNF
```

### 2.2 Identifier naming — do not "fix" this

Prisma created **PascalCase table names** and **camelCase column names**. In Postgres these require double-quoting forever, because unquoted identifiers fold to lowercase. Drizzle quotes all identifiers it emits, so this works — but every table and column must be given its name **explicitly** in the schema. Never rely on Drizzle inferring a name from the TS property.

Renaming to `snake_case` is the conventional Postgres choice, but it invalidates the data-export script in §3 and every hand-written SQL query. Keep the Prisma names. This is a port, not a redesign.

### 2.3 `shelf-api/src/db/schema.ts`

```ts
import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const readStatus = pgEnum("ReadStatus", [
  "TBR",
  "READING",
  "FINISHED",
  "DNF",
]);

export const users = pgTable("User", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  // Nullable by decision — see MIGRATION_PLAN.md §0.1
  profilePicture: text("profilePicture"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const books = pgTable("Book", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  defaultCover: text("defaultCover").notNull(),
  covers: jsonb("covers").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const userReads = pgTable(
  "UserRead",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
    bookId: integer("bookId")
      .notNull()
      .references(() => books.id, { onDelete: "restrict", onUpdate: "cascade" }),
    cover: text("cover").notNull(),
    status: readStatus("status").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Prisma's @updatedAt was client-side. Drizzle's $onUpdate is also
    // client-side and only fires on db.update() — raw SQL writes bypass it.
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("UserRead_userId_bookId_key").on(t.userId, t.bookId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  reads: many(userReads),
}));

export const booksRelations = relations(books, ({ many }) => ({
  reads: many(userReads),
}));

export const userReadsRelations = relations(userReads, ({ one }) => ({
  user: one(users, { fields: [userReads.userId], references: [users.id] }),
  book: one(books, { fields: [userReads.bookId], references: [books.id] }),
}));
```

### 2.4 `shelf-api/src/db/client.ts`

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import { env } from "../config/env.js";

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  // Managed Postgres on Railway/Render terminates plaintext connections.
  ssl: env.DATABASE_URL.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });
export { pool };
```

### 2.5 `shelf-api/drizzle.config.ts`

```ts
import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // No `casing` option. It only accepts "snake_case" | "camelCase" — there is
  // no "preserve" — and either would rewrite the identifiers. Naming every
  // table and column explicitly in schema.ts is what keeps Prisma's quoted
  // PascalCase/camelCase intact.
});
```

Generate and apply, from inside `shelf-api/`:

```bash
npm run db:generate   # drizzle-kit generate
npm run db:migrate    # drizzle-kit migrate
npm run db:seed
```

Commit `shelf-api/drizzle/`. Use `drizzle-kit generate` + `migrate` — **not** `drizzle-kit push`. Push has no migration history, which you'll want on a hosted database.

### 2.6 `docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:17-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: shelfwatch
      POSTGRES_PASSWORD: shelfwatch
      POSTGRES_DB: shelfwatch
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U shelfwatch"]
      interval: 5s
      retries: 10
volumes:
  pgdata:
```

Local `DATABASE_URL`: `postgres://shelfwatch:shelfwatch@localhost:5432/shelfwatch`

---

## 3. Seed data

**There is no data migration.** `dev.db` holds nothing worth keeping — the new Postgres database starts empty and is populated by a seed script. Do not write an export/import step, and do not carry `dev.db` forward.

Write `shelf-api/src/db/seed.ts`. It is the only source of local and CI data, so it needs to cover every branch the API can take:

| Fixture                                  | Exists to exercise                                      |
| ---------------------------------------- | -------------------------------------------------------- |
| A user with books in **all four** statuses | `countsByStatus` with no zeroes; the `/books` list       |
| A user with books in **one** status        | The zero-fill guarantee (§4.2) — three keys must be `0`  |
| A user with **zero** books                 | Empty shelf ≠ missing user; `totalBooks: 0`              |
| A username that is **never** seeded        | The 404 path. Document it in a comment, e.g. `"nobody"`. |
| Two reads on one user with distinct `updatedAt` | The `ORDER BY updatedAt DESC` in `getUserShelf`     |

Requirements:

- **Idempotent.** `.onConflictDoNothing()` against `User.username` and the `UserRead_userId_bookId_key` composite. Running it twice must not error or duplicate.
- **No explicit ids.** Let the `serial` sequences assign them. This is the payoff for having no data import — there are no id collisions to reason about and no `setval` reset to remember.
- **Real values for the unused columns.** `Book.defaultCover`, `Book.covers`, and `UserRead.cover` are `NOT NULL` (§0.4). `covers` is `jsonb` — seed an actual object/array, not a JSON string, or Drizzle will store a quoted string and any future reader will get a `string` where it expects structure.

Add a `db:reset` script — drop, migrate, seed — since a fresh database is now the normal way to get to a known state:

```json
"db:reset": "drizzle-kit drop && npm run db:migrate && npm run db:seed"
```

---

## 4. Backend: Fastify

### 4.1 Dependencies

Install from the repo root with `-w shelf-api` so they land in the right `package.json` and the single lockfile stays coherent:

```
fastify @fastify/cors @fastify/autoload fastify-plugin drizzle-orm pg dotenv zod @shelf-watch/shared
-D drizzle-kit tsx typescript @types/node @types/pg pino-pretty vitest
```

`@fastify/autoload` + `fastify-plugin` are what make the conventional `plugins/` + `routes/` layout work; they're the two dependencies `fastify-cli` scaffolds with.

`shelf-api/package.json`:

```json
{
  "name": "shelf-api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "prebuild": "npm run build -w @shelf-watch/shared",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/db/seed.ts",
    "db:reset": "drizzle-kit drop && npm run db:migrate && npm run db:seed"
  }
}
```

`"type": "module"` is why every relative import in this plan carries a `.js` extension — that's Node ESM resolution, and TypeScript requires you to write the *output* extension even in `.ts` source.

### 4.2 API contract — preserve exactly

Every route moves from `/api/*` to the API service root. Paths stay identical (`/api/users/...`), so the frontend's fetch paths are unchanged apart from the origin.

| Method | Path                          | Current source                        | Response                                                       | Status |
| ------ | ----------------------------- | ------------------------------------- | -------------------------------------------------------------- | ------ |
| GET    | `/api/users`                  | `app/api/users/route.ts`              | `User[]` — full rows                                            | 200    |
| POST   | `/api/users`                  | `app/api/users/route.ts`              | created `User`                                                  | 201    |
| GET    | `/api/users/:username`        | `app/api/users/[username]/route.ts`   | `ShelfSummary`                                                  | 200    |
| ″      | ″                             | ″                                     | `{ "error": "User not found" }`                                 | 404    |
| GET    | `/api/users/:username/books`  | `.../books/route.ts`                  | `ShelfBook[]` — **the bare array**, not the full `Shelf`        | 200    |
| ″      | ″                             | ″                                     | `{ "error": "User not found" }`                                 | 404    |
| GET    | `/health`                     | new                                   | `{ "status": "ok" }`                                            | 200    |

Response shapes, verbatim from `lib/services/users.ts`:

```ts
type ReadStatus  = "TBR" | "READING" | "FINISHED" | "DNF";
type StatusCounts = Record<ReadStatus, number>;
type ShelfSummary = { username: string; totalBooks: number; countsByStatus: StatusCounts };
type ShelfBook    = { id: number; title: string; author: string; status: ReadStatus };
type Shelf        = ShelfSummary & { books: ShelfBook[] };
```

Two behaviours that are easy to lose and must be preserved:

1. **`countsByStatus` always contains all four keys, zero-filled.** `emptyCounts()` seeds every enum member. A status with no rows must serialize as `0`, never be absent.
2. **`/books` returns the array only.** It computes a full `Shelf` and returns `shelf.books`. Do not "improve" it into `{ books: [...] }` — that's a breaking contract change.

`getUserShelf` orders reads by `updatedAt DESC`. Preserve that ordering.

**Existing bug to fix while porting:** `GET /api/users` returns raw rows including `createdAt` and (once added) `profilePicture`. That's fine, but be explicit — select columns by name rather than `SELECT *`, so a future column isn't leaked by accident.

### 4.3 `shelf-api/src/config/env.ts`

```ts
import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  // Comma-separated allowed origins for CORS.
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = schema.parse(process.env);
```

Fail fast on a missing `DATABASE_URL` — far better than a connection error 30 seconds into a deploy.

### 4.4 `shelf-api/src/app.ts` — autoloaded

The conventional Fastify entry: `app.ts` wires up autoloading and nothing else. Adding a route later means adding a file, not editing this.

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import autoload from "@fastify/autoload";
import { env } from "./config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger:
      env.NODE_ENV === "production"
        ? true
        : { transport: { target: "pino-pretty" } },
  });

  // Cross-cutting concerns. Each is wrapped in fastify-plugin so its
  // decorators are visible to every route.
  await app.register(autoload, {
    dir: path.join(__dirname, "plugins"),
  });

  // Directory structure becomes the URL prefix:
  //   routes/health/index.ts    → /health
  //   routes/api/users/index.ts → /api/users
  await app.register(autoload, {
    dir: path.join(__dirname, "routes"),
    dirNameRoutePrefix: true,
  });

  return app;
}
```

`buildApp` is `async` because both `register` calls are awaited — the tests in Appendix B depend on the plugin tree being fully loaded before `app.inject()` runs.

### 4.5 `shelf-api/src/plugins/`

Every file here **must** be wrapped in `fastify-plugin`. Without the wrapper, Fastify encapsulates the plugin and its decorators are invisible to the routes — the single most common autoload mistake, and it fails at runtime with `app.db is not a function`, not at compile time.

`plugins/db.ts`:

```ts
import fp from "fastify-plugin";
import { db, pool } from "../db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}

export default fp(async (app) => {
  app.decorate("db", db);
  // Close the pool when Fastify shuts down, so tests and SIGTERM both drain.
  app.addHook("onClose", async () => {
    await pool.end();
  });
});
```

`plugins/cors.ts`:

```ts
import fp from "fastify-plugin";
import cors from "@fastify/cors";
import { env } from "../config/env.js";

export default fp(async (app) => {
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    credentials: true,
  });
});
```

`plugins/error-handler.ts`:

```ts
import fp from "fastify-plugin";

export default fp(async (app) => {
  app.setErrorHandler((err, _req, reply) => {
    app.log.error(err);
    const status = err.statusCode ?? 500;
    reply
      .status(status)
      .send({ error: status === 500 ? "Internal server error" : err.message });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: "Not found" });
  });
});
```

The error handler never echoes an internal error message on a 500. The `error` key matches the shape the existing 404s already use, so the client has one error format to parse.

### 4.6 `shelf-api/src/server.ts`

```ts
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();

// 0.0.0.0 is required on Railway and Render — binding to localhost makes the
// service unreachable and the platform health check will fail the deploy.
await app.listen({ port: env.PORT, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close(); // triggers the onClose hook that drains the pg pool
    process.exit(0);
  });
}
```

### 4.7 `shelf-api/src/routes/api/users/index.ts`

The file's **location** supplies the `/api/users` prefix — the route paths below are relative to it. Do not add a `prefix` option, and do not export this wrapped in `fastify-plugin`.

```ts
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { getUserShelf, getUserShelfSummary } from "../services/users.js";

const usernameParams = z.object({ username: z.string().min(1) });
const createUserBody = z.object({
  username: z.string().min(1).max(64),
  profilePicture: z.string().url().optional(),
});

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () =>
    db
      .select({
        id: users.id,
        username: users.username,
        profilePicture: users.profilePicture,
        createdAt: users.createdAt,
      })
      .from(users),
  );

  app.post("/", async (req, reply) => {
    const parsed = createUserBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }
    try {
      const [user] = await db.insert(users).values(parsed.data).returning();
      return reply.status(201).send(user);
    } catch (err) {
      // 23505 = unique_violation. Drizzle wraps driver errors in
      // DrizzleQueryError, so the pg code is on `.cause`, not on err itself.
      if (isUniqueViolation(err)) {
        return reply.status(409).send({ error: "Username already taken" });
      }
      throw err;
    }
  });

  app.get("/:username", async (req, reply) => {
    const { username } = usernameParams.parse(req.params);
    const summary = await getUserShelfSummary(username);
    if (!summary) return reply.status(404).send({ error: "User not found" });
    return summary;
  });

  app.get("/:username/books", async (req, reply) => {
    const { username } = usernameParams.parse(req.params);
    const shelf = await getUserShelf(username);
    if (!shelf) return reply.status(404).send({ error: "User not found" });
    return shelf.books; // bare array — see §4.2
  });
};
```

400 on a bad body and 409 on a duplicate are **new** behaviours replacing today's unhandled 500s (§0.3). Everything else matches the current contract exactly.

### 4.8 `shelf-api/src/services/users.ts` — the Prisma → Drizzle port

This is the only genuinely non-mechanical translation in the migration. Keep the file's structure, names, JSDoc, and the null-vs-empty-shelf distinction.

```ts
import { eq, desc, count } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, books, userReads, readStatus } from "../db/schema.js";
import type { Shelf, ShelfSummary, StatusCounts } from "@shelf-watch/shared";

/**
 * Every status seeded to 0, derived from the schema enum so new statuses show
 * up automatically instead of being silently missing from responses.
 */
function emptyCounts(): StatusCounts {
  return Object.fromEntries(
    readStatus.enumValues.map((status) => [status, 0]),
  ) as StatusCounts;
}

/**
 * Counts only, without loading any book rows.
 * Returns null if the username doesn't exist, which callers should distinguish
 * from a user whose shelf is simply empty.
 */
export async function getUserShelfSummary(
  username: string,
): Promise<ShelfSummary | null> {
  const [user] = await db
    .select({ username: users.username, id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) return null;

  const grouped = await db
    .select({ status: userReads.status, n: count() })
    .from(userReads)
    .where(eq(userReads.userId, user.id))
    .groupBy(userReads.status);

  const countsByStatus = emptyCounts();
  let totalBooks = 0;
  for (const row of grouped) {
    countsByStatus[row.status] = row.n;
    totalBooks += row.n;
  }

  return { username: user.username, totalBooks, countsByStatus };
}

/**
 * Books plus counts. Derives the counts from the rows it already loaded rather
 * than issuing a second aggregate query.
 * Returns null if the username doesn't exist.
 */
export async function getUserShelf(username: string): Promise<Shelf | null> {
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) return null;

  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      status: userReads.status,
    })
    .from(userReads)
    .innerJoin(books, eq(userReads.bookId, books.id))
    .where(eq(userReads.userId, user.id))
    .orderBy(desc(userReads.updatedAt));

  const countsByStatus = emptyCounts();
  for (const row of rows) countsByStatus[row.status] += 1;

  return {
    username: user.username,
    totalBooks: rows.length,
    countsByStatus,
    books: rows,
  };
}
```

Translation notes:

- **`Promise.all` is gone from `getUserShelfSummary`.** Prisma could run the user lookup and a `groupBy` filtered on `user: { username }` concurrently. The Drizzle version needs `user.id` for the aggregate, so the queries are sequential. If the extra round-trip matters, replace both with a single `LEFT JOIN` + `GROUP BY` and detect a missing user by an empty result — but only after measuring. Correctness first.
- **`_count: true` → `count()`.** Prisma returns `_count` as a number here; Drizzle's `count()` returns a number via the `pg` type parser. Verify it isn't a string in your version — `COUNT()` is `bigint` in Postgres and some drivers hand it back as a string, which would make `totalBooks` a concatenation instead of a sum. Assert this in a test.
- **Nested `select` with `reads: { book: {...} }` → explicit `innerJoin`.** Drizzle's relational query API (`db.query.users.findFirst({ with: { reads: { with: { book: true } } } })`) is closer to the Prisma shape and also valid; the flat join is used above because it maps 1:1 onto the output type with no post-processing.
- **`orderBy: { status: "asc" }` on the groupBy is dropped** — the result is folded into a keyed object, so the order was never observable.

### 4.9 `shelf-shared` — the API contract package

One definition of the contract, imported by both projects. This is the single source of truth for what the API sends and what the client expects.

`shelf-shared/package.json`:

```json
{
  "name": "@shelf-watch/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

`shelf-shared/tsconfig.json` — must emit both JS and declarations:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

`shelf-shared/src/index.ts`:

```ts
export const READ_STATUSES = ["TBR", "READING", "FINISHED", "DNF"] as const;
export type ReadStatus = (typeof READ_STATUSES)[number];

export type StatusCounts = Record<ReadStatus, number>;
export type ShelfSummary = { username: string; totalBooks: number; countsByStatus: StatusCounts };
export type ShelfBook = { id: number; title: string; author: string; status: ReadStatus };
export type Shelf = ShelfSummary & { books: ShelfBook[] };
export type User = { id: number; username: string; profilePicture: string | null; createdAt: string };
```

`READ_STATUSES` replaces `import { ReadStatus } from "@/app/generated/prisma/enums"`, which was the only reason the frontend depended on generated Prisma code.

**Consuming it.** Add to both `shelf-api/package.json` and `shelf-web-client/package.json`:

```json
"dependencies": { "@shelf-watch/shared": "*" }
```

The `*` is deliberate — npm resolves it to the local workspace rather than looking for a registry package. Then import normally in either project:

```ts
import { READ_STATUSES, type Shelf } from "@shelf-watch/shared";
```

### 4.9.1 Three things that will bite whoever builds this

**1. It must be built before either project runs.** `READ_STATUSES` is a runtime value, not just a type — types would be erased, but this array has to exist as real JS at runtime. An unbuilt `shelf-shared` fails with `Cannot find module '@shelf-watch/shared'` pointing at a `dist/` that doesn't exist.

Handle it with a `prepare` script in `shelf-shared` (npm runs it automatically after `npm install` at the root):

```json
"scripts": { "build": "tsc", "prepare": "npm run build" }
```

Belt and braces: add `"prebuild": "npm run build -w @shelf-watch/shared"` to `shelf-api` and `shelf-web-client` so a production build can never race ahead of its dependency.

**2. Editing shared types mid-session won't take effect until it's rebuilt.** Both consumers read `dist/`, not `src/`. Run `npm run dev -w @shelf-watch/shared` (tsc watch) in a fourth terminal while actively changing the contract, or rebuild by hand. Vite will hot-reload the change once `dist/` updates; the API needs `tsx watch` to notice, which it will.

**3. `readStatus.enumValues` in `db/schema.ts` is still a separate list.** The shared package removed the *client/server* duplication, but the Drizzle `pgEnum` necessarily declares its own values — that one has a live Postgres enum type behind it. Keep the assertion in the test suite:

```ts
expect(readStatus.enumValues).toEqual(READ_STATUSES);
```

That test is now the only guard against contract drift anywhere in the system, which makes it worth more than its two lines suggest.

**Where this goes next.** With one shared definition, upgrading to generated types later is a natural step rather than a rewrite: define the shapes as Zod schemas in `shelf-shared`, derive the TS types with `z.infer`, and have `shelf-api` use those same schemas for request validation (§4.6) and response serialization. The contract then validates itself at runtime on the server and types the client from the same source. Worth doing when the API grows past these four endpoints — not now.

Note `createdAt: string` — JSON has no Date type, so it arrives at the client as an ISO string even though Drizzle hands the server a `Date`.

---

## 5. Frontend: `shelf-web-client` (React + Vite, minimal)

Deliberately thin. Its job is to demonstrate the endpoints respond correctly.

Scaffold it with the standard tool so the layout matches what every React developer and model expects:

```bash
npm create vite@latest shelf-web-client -- --template react-ts
```

Then add `react-router` and `@shelf-watch/shared`. Keep the generated `src/` conventions — `main.tsx` mounts, `App.tsx` holds routes, `pages/` for route components, `components/` for reusable pieces, `services/` for I/O. Delete the generated demo counter, `App.css`, and the Vite/React logo assets.

Skip Tailwind unless it's free — plain CSS or no CSS is fine for a throwaway UI.

`shelf-web-client/package.json` — Vite's defaults plus the shared-package guard:

```json
"dev": "vite",
"prebuild": "npm run build -w @shelf-watch/shared",
"build": "tsc -b && vite build",
"preview": "vite preview"
```

### 5.1 Routes

| Path              | Component | Calls                                                        |
| ----------------- | --------- | ------------------------------------------------------------ |
| `/`               | `Home`    | `GET /api/users` → list, each linking to its shelf; a create-user form hitting `POST /api/users` |
| `/shelf/:username`| `Shelf`   | `GET /api/users/:username` and `GET /api/users/:username/books` |

`Shelf` replaces `app/shelf/[username]/page.tsx`. That page was a React Server Component doing a direct `getUserShelf()` call; the SPA version fetches over HTTP and needs explicit loading / error / 404 states the RSC version got for free from `notFound()`.

### 5.2 `shelf-web-client/src/services/api.ts`

```ts
import type { User, ShelfSummary, ShelfBook } from "@shelf-watch/shared";

// Empty default = same-origin, which the dev proxy (§5.3) handles locally.
const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json();
}

export const getUsers = () => get<User[]>("/api/users");
export const getShelfSummary = (u: string) =>
  get<ShelfSummary>(`/api/users/${encodeURIComponent(u)}`);
export const getShelfBooks = (u: string) =>
  get<ShelfBook[]>(`/api/users/${encodeURIComponent(u)}/books`);
```

`encodeURIComponent` on the username matters — Next's dynamic segment decoding was implicit, and a username with a slash or space silently produces a wrong URL otherwise.

Render `ApiError` with `status === 404` as "user not found", anything else as a generic failure.

### 5.3 Vite config

Set a dev proxy so local development is same-origin and CORS never enters the picture:

```ts
server: {
  proxy: { "/api": { target: "http://localhost:3001", changeOrigin: true } },
}
```

With the proxy in place, leave `VITE_API_URL` unset locally and set it only in the production build.

---

## 6. Deployment

Two services. Railway and Render are equivalent here; instructions cover both.

Still two independent platform services — but because `@shelf-watch/shared` resolves through the root lockfile, **both build from the repo root**, not from their own subdirectory. Leave the platform's root-directory setting at the repo root and select the project with `-w` instead. Pointing a service at `shelf-api/` will fail: npm finds no lockfile there and cannot resolve the workspace dependency.

The `prebuild` hooks (§4.9.1) build `shelf-shared` first, so neither build command needs to mention it.

### 6.1 API service (`shelf-api`)

- **Root directory**: repo root (default — do not set it to `shelf-api`)
- **Build**: `npm ci && npm run build -w shelf-api`
- **Start**: `npm run db:migrate -w shelf-api && node shelf-api/dist/server.js`
- **Health check path**: `/health`
- **Env**: `DATABASE_URL` (from the managed Postgres addon), `PORT` (injected by the platform — read it, never hardcode), `NODE_ENV=production`, `CORS_ORIGIN=<frontend URL>`.

`npm ci` at the root installs all three workspaces, so this build pulls in the frontend's dependencies too. That's the cost of the shared package (§1) — slower builds, no correctness impact. If build minutes ever matter, `npm ci --workspace shelf-api --workspace @shelf-watch/shared --include-workspace-root` narrows it.

Running migrations in the start command is fine for a single-instance service. If you ever scale past one instance, move it to a release/pre-deploy command so concurrent boots don't race.

### 6.2 Web service (`shelf-web-client`)

- Static site. **Root directory**: repo root. **Build**: `npm ci && npm run build -w shelf-web-client`, **publish dir**: `shelf-web-client/dist`.
- **Build-time env**: `VITE_API_URL=<api service URL>`. Vite inlines `import.meta.env` at build time — changing it later requires a rebuild, not a restart.
- **SPA rewrite is mandatory**: all paths → `/index.html`, or a hard refresh on `/shelf/duy` 404s. Render: a rewrite rule `/*` → `/index.html`. Railway: use a static adapter or serve `dist/` through the API with a catch-all.

### 6.3 CORS

`CORS_ORIGIN` must be the exact frontend origin — scheme + host, no trailing slash. Both platforms give the API a different domain than the frontend, so this is a real cross-origin setup, not a formality.

---

## 7. Execution phases

Each phase ends in a working tree. Don't start the next until the current one's checks pass.

**Phase 1 — Scaffold.** Branch. Create the root workspace `package.json`, then `shelf-shared/`, `shelf-api/`, and `shelf-web-client/` alongside the old Next.js files, plus `docker-compose.yml`. Build the shared package first — the other two depend on it.
✅ `npm install` at the root succeeds; exactly one `package-lock.json` exists.
✅ `npm run build:shared` produces `shelf-shared/dist/index.js` **and** `index.d.ts`.
✅ `ls -l shelf-api/node_modules/@shelf-watch/shared` shows a symlink to `../../shelf-shared`.
✅ A scratch `import { READ_STATUSES } from "@shelf-watch/shared"` type-checks and runs in both projects.

**Phase 2 — Database.** Drizzle schema, `drizzle.config.ts`, generate + apply migrations, seed script.
✅ `\d "User"`, `\d "Book"`, `\d "UserRead"` in psql match §2.1 — including the quoted casing, the unique indexes, and both FK actions (`ON DELETE RESTRICT`, `ON UPDATE CASCADE`).
✅ `SELECT enum_range(NULL::"ReadStatus")` returns all four values.
✅ Seed runs twice in a row without error (idempotency).
✅ `npm run db:reset` gets back to a known state from anywhere.

**Phase 3 — API.** Autoloaded plugins and routes, env, error handler, service port.
✅ `app.printRoutes()` lists exactly the paths in §4.2 — this is the check that catches an autoload prefix mistake.
✅ Every row in the §4.2 table verified with curl against seeded data.
✅ `countsByStatus` has four keys for the single-status seed user.
✅ `/api/users/nope` → 404 `{"error":"User not found"}`.
✅ `/api/users/:username/books` returns a bare JSON array.
✅ `totalBooks` is a number, not a string (§4.9).
✅ `readStatus.enumValues` equals `READ_STATUSES` (§4.9.1).

**Phase 4 — Frontend.** Vite app, two routes, dev proxy.
✅ Both routes render against the live API. 404 and loading states behave.
✅ A hard refresh on `/shelf/<user>` works in `vite preview`, not just `vite dev`.

**Phase 5 — Delete Next.js.** Remove `app/`, `next.config.ts`, `next-env.d.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `public/`, `prisma/`, `prisma.config.ts`, `lib/`, `tsconfig.tsbuildinfo`, and `dev.db`. Strip the root `package.json` down to the workspaces + scripts block in §1 — every Next.js and Prisma dependency comes out, and the root keeps no `dependencies` at all. Delete the root `tsconfig.json` (each workspace has its own). `git rm --cached dev.db` and add `*.db` to `.gitignore` (§0.5).
✅ Root `package.json` has `workspaces`, `scripts`, and nothing else.
✅ Nothing remains at the repo root but the two config files, `.gitignore`, the three workspace directories, and the markdown.
✅ `grep -rl "next\|prisma" --include=*.ts --include=*.tsx --include=*.json . | grep -v node_modules` returns nothing unexpected.
✅ Clean clone → `npm ci` → `npm run build:shared` → `docker compose up -d` → migrate → seed → both dev servers → app works.

**Phase 6 — Deploy.** API first, **root directory left at the repo root** and built with `-w shelf-api` (§6.1); confirm `/health` and one real endpoint over the public URL. Then the frontend, same root, `-w shelf-web-client`, publish dir `shelf-web-client/dist`, `VITE_API_URL` pointed at the API.

### A note on `AGENTS.md` / `CLAUDE.md`

`AGENTS.md` contains a block written and re-added by `next dev`, instructing agents to read `node_modules/next/dist/docs/`. Once Next is gone in Phase 6 that block is stale and its instructions unfollowable. Rewrite `AGENTS.md` for the new stack in the same phase.

---

## Appendix A — If you keep SQLite locally instead of Postgres

You picked Drizzle "for the SQLite database" but Postgres for production. Drizzle's schema is **dialect-specific**: `drizzle-orm/sqlite-core` and `drizzle-orm/pg-core` export different builders, `pgEnum` has no SQLite equivalent (you'd use `text({ enum: [...] })`), `jsonb` becomes `text` with manual JSON handling, and `timestamp` becomes `integer({ mode: "timestamp" })`. Supporting both means two schema files, two migration folders, and two sets of generated SQL that drift apart — plus a class of bug that only appears in production.

The plan above therefore uses Postgres in both places, with Docker covering local. If you'd rather stay on SQLite locally anyway:

- Use `drizzle-orm/better-sqlite3` + the `sqlite-core` builders against a **fresh** SQLite file — there is no data to preserve either way (§3).
- Accept that production is then an untested dialect, and add an integration test suite that runs against Postgres in CI before any deploy.
- The service layer in §4.8 ports across unchanged — `eq`, `desc`, `count`, `innerJoin` are dialect-agnostic. Only `schema.ts` and `client.ts` differ.

## Appendix B — Testing (recommended, not required)

`buildApp()` lives in `app.ts` separately from `server.ts` specifically so tests can use `app.inject()` — Fastify's in-process HTTP simulation, no port binding needed:

```ts
// shelf-api/test/routes/users.test.ts
const app = await buildApp();
const res = await app.inject({ method: "GET", url: "/api/users/nope" });
expect(res.statusCode).toBe(404);
expect(res.json()).toEqual({ error: "User not found" });
```

With Vitest and the Docker Postgres, the §7 Phase 3 checklist becomes an automated suite rather than a manual curl session. Highest-value cases: the zero-filled `countsByStatus`, the bare-array `/books` response, both 404 paths, the `totalBooks` number-not-string assertion, and `readStatus.enumValues` matching `READ_STATUSES` (§4.9).

Call `await app.close()` in an `afterAll` — the `onClose` hook in `plugins/db.ts` drains the pg pool, and without it Vitest hangs on open handles.

## Appendix C — Runtime and tooling: settled decisions

**Node + npm throughout. No Bun.** Decided; do not substitute it.

For context on why the question doesn't quite parse as an either/or: Vite is a frontend dev server and bundler, Bun is a runtime and package manager. They occupy different slots. Vite is used on the frontend regardless — Bun has no alternative to it, only the ability to run it. The real question was Node vs Bun on the *backend*, and the answer is Node:

- `pg` is native-adjacent and exactly the class of dependency where Bun compatibility gaps surface. Debugging connection-pool behaviour in an unfamiliar runtime is not what you want mid-migration.
- Railway and Render both default to Node; Bun needs explicit configuration.
- This migration already changes the framework, ORM, database, and project structure. A runtime change adds one more candidate cause to every failure.

Concretely, that means: `tsx watch` for API dev, `tsc` for API builds, `node dist/server.js` in production, Vitest for tests, `npm` for installs and workspace resolution. **Do not** introduce `bun.lockb` — the workspace setup in §1 and §4.8 depends on npm's single root `package-lock.json`.
