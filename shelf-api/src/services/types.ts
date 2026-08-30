import type { books, userReads } from "../db/schema.js";

/**
 * Internal to shelf-api — not part of the `@shelf-watch/shared` API contract.
 * Nothing here has ever crossed into a JSON response, so there's no reason to
 * force the web client to build against it or to hold it to the client-facing
 * conventions in shelf-shared (ISO date strings, etc).
 */

/**
 * The `book` row shape, inferred straight from the Drizzle table — same
 * reasoning as `UserReadRow` below. `defaultCover` is the raw NOT NULL column
 * (an empty string means "no cover yet"), not the null-normalised `cover`
 * the API contract exposes; do that normalisation at the point this value
 * crosses into a response, the same way `UserReadRow`'s dates get
 * `.toISOString()` there instead of here.
 */
export type Book = typeof books.$inferSelect;

/**
 * The raw `user_read` row shape, inferred straight from the Drizzle table
 * rather than hand-typed — it can't drift from the real columns, and it can't
 * typo a type name the way a hand-written version can.
 *
 * Named `...Row` to keep it distinct from the `UserRead` in `@shelf-watch/
 * shared`, which is the client-facing contract shape: this one has `Date`
 * objects for `createdAt`/`updatedAt` (`schema.ts` declares both columns
 * `{ mode: "date" }`) and the raw NOT NULL `cover` string. The service that
 * returns it converts to the shared shape — dates to ISO strings, `cover` to
 * `null` — the same way `listUsers()` does for `User.createdAt`.
 */
export type UserReadRow = typeof userReads.$inferSelect;
