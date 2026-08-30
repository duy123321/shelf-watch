import type { books, userReads } from "../db/schema.js";

/**
 * Internal to shelf-api — not part of the `@shelf-watch/shared` API contract.
 * Nothing here has ever crossed into a JSON response, so there's no reason to
 * force the web client to build against it or to hold it to the client-facing
 * conventions in shelf-shared (ISO date strings, etc).
 */

/**
 * The `book` row shape, inferred straight from the Drizzle table — same
 * reasoning as `UserRead` below. `defaultCover` is the raw NOT NULL column
 * (an empty string means "no cover yet"), not the null-normalised `cover`
 * the API contract exposes; do that normalisation at the point this value
 * crosses into a response, the same way `UserRead`'s dates get `.toISOString()`
 * there instead of here.
 */
export type Book = typeof books.$inferSelect;

/**
 * The `user_read` row shape, inferred straight from the Drizzle table rather
 * than hand-typed — it can't drift from the real columns, and it can't typo
 * a type name the way a hand-written version can.
 *
 * `createdAt`/`updatedAt` come back as `Date` objects, not ISO strings:
 * `schema.ts` declares both columns with `{ mode: "date" }`, so that's what
 * Drizzle actually returns. Call `.toISOString()` at whatever point this
 * value crosses into a JSON response — the same thing `listUsers()` already
 * does for `User.createdAt` — rather than typing it as `string` here and
 * lying about what a caller gets before that conversion happens.
 */
export type UserRead = typeof userReads.$inferSelect;
