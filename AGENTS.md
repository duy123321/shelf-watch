# shelf-watch — agent notes

Three npm workspaces under a thin root. **Run `npm install` from the repo root**, never from inside a workspace — there is one lockfile and the workspaces are linked through it.

| Workspace          | What it is                                    |
| ------------------ | --------------------------------------------- |
| `shelf-shared`     | `@shelf-watch/shared` — the API contract types |
| `shelf-api`        | Fastify 5 + Drizzle + Postgres                 |
| `shelf-web-client` | React 19 + Vite + React Router (SPA)           |

## Things that will bite you

**`shelf-shared` must be built before either project runs.** It exports `READ_STATUSES`, a runtime value, so it needs real JS in `dist/`. Run `npm run build:shared`. Both projects have a `prebuild` hook, but `npm run dev` does not — build it by hand after a fresh clone, and run `npm run dev:shared` (tsc watch) while actively editing the contract.

**Route files are autoloaded; the directory path is the URL prefix.** `shelf-api/src/routes/api/users/index.ts` serves `/api/users`. Never pass a `prefix` option and never wrap a route file in `fastify-plugin`.

**Plugin files are autoloaded and MUST be wrapped in `fastify-plugin`.** Without the wrapper the decorator is encapsulated and routes fail at runtime with `app.db is undefined` — there is no compile-time error.

**Imports in `shelf-api` carry `.js` extensions even in `.ts` source.** That is NodeNext resolution, not a mistake. `vitest.config.ts` has an alias that strips them for the test run, plus `@fastify/autoload` inlined so its dynamic imports go through the same resolver.

**Table and column names are quoted PascalCase/camelCase** (`"User"`, `"UserRead"`, `"profilePicture"`), inherited from the original Prisma schema. Do not "fix" them to snake_case, and do not add a `casing` option to `drizzle.config.ts` — it only accepts `snake_case`/`camelCase` and either would rewrite them.

**Drizzle wraps driver errors.** A Postgres error code lives on `err.cause.code`, not `err.code`. See `isUniqueViolation` in the users route.

**The web client uses Tailwind v4 + shadcn/ui.** Add components with `npx shadcn@latest add <name>` from `shelf-web-client`; they land in `src/components/ui` and import through the `@/` alias (declared in both `vite.config.ts` and `tsconfig.app.json` — keep the two in sync). Tailwind is configured CSS-first in `src/index.css`; there is no `tailwind.config.js`. The shadcn tokens there are named `--border-token`/`--accent-token`/`--muted-token` because the pre-shadcn pages (`Shelf`, `NotFound`) still use the hand-rolled `--border`/`--accent`/`--muted` variables further down the same file. Do not collapse the two sets until those pages are ported.

## API contract — do not break

- `countsByStatus` always has all four statuses; a status with no rows is `0`, never absent.
- `GET /api/users/:username/books` returns a **bare array**, not `{ books: [...] }`.
- Books are ordered by `updatedAt DESC`.
- Every error response is `{ "error": string }`.
- `READ_STATUSES` in `shelf-shared` and `readStatus.enumValues` in `shelf-api/src/db/schema.ts` must stay equal — a test asserts it.

## Before you commit

```bash
npm run build && npm test
```

Tests need Postgres running (`npm run db:up`) and the seed data (`npm run db:reset`).

## Dependency overrides

The root `package.json` pins a patched `esbuild` inside `@esbuild-kit/core-utils`. `drizzle-kit` still depends on those abandoned packages and no release has dropped them.

**Never run `npm audit fix --force` here.** It "fixes" that advisory by downgrading `drizzle-kit` from 0.31 to 0.18, which breaks migration generation. The override clears the advisory without the downgrade; `npm audit` reports zero vulnerabilities.
