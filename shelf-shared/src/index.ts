/**
 * The shelf-watch API contract.
 *
 * This is the single source of truth for the shapes the API sends and the
 * client expects. Both `shelf-api` and `shelf-web-client` import it as
 * `@shelf-watch/shared`.
 *
 * It compiles to real JS (not just types) because `READ_STATUSES` is a runtime
 * value — run `npm run build:shared` before starting either project.
 */

/**
 * Every reading status, in display order.
 *
 * This list is mirrored by the `readStatus` pgEnum in
 * `shelf-api/src/db/schema.ts`, which has a live Postgres enum type behind it.
 * A test asserts the two stay equal.
 */
export const READ_STATUSES = ["TBR", "READING", "FINISHED", "DNF"] as const;

export type ReadStatus = (typeof READ_STATUSES)[number];

/** Human-readable labels, carried over from the original Next.js shelf page. */
export const STATUS_LABELS: Record<ReadStatus, string> = {
  TBR: "To read",
  READING: "Reading",
  FINISHED: "Finished",
  DNF: "Did not finish",
};

/** Always contains all four statuses. A status with no rows is `0`, never absent. */
export type StatusCounts = Record<ReadStatus, number>;

export type ShelfSummary = {
  username: string;
  totalBooks: number;
  countsByStatus: StatusCounts;
};

export type ShelfBook = {
  id: number;
  title: string;
  author: string;
  status: ReadStatus;
  /**
   * Absolute URL of the book's cover, or `null` when there is no art for it.
   *
   * Comes from `book.default_cover`, which `npm run db:covers` fills in from
   * Open Library. An empty column is normalised to `null` here so the client
   * has one thing to check rather than two.
   */
  cover: string | null;
};

/** Body of `PATCH /api/user-reads`. */
export type UpdateReadStatusBody = {
  userId: number;
  bookId: number;
  status: ReadStatus;
};

/**
 * One `user_read` row — a single book on one user's shelf, plus its current
 * status. This is exactly what `PATCH /api/user-reads` returns: the read
 * record only, never book fields like `title` or `author`. Those live on the
 * immutable `book` row and never change under a status edit.
 *
 * `createdAt` / `updatedAt` are ISO strings, like `User.createdAt` — JSON has
 * no Date type.
 */
export type UserRead = {
  /** The `user_read` row id — NOT the book id. The book is `bookId`. */
  id: number;
  userId: number;
  bookId: number;
  status: ReadStatus;
  /**
   * Per-user cover override — the edition jacket this user picked, or `null`
   * when they haven't and the book-level cover (`ShelfBook.cover`) applies.
   * Nothing sets this yet, so in practice it is always `null` today.
   */
  cover: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Shelf = ShelfSummary & {
  books: ShelfBook[];
};

/** `createdAt` is an ISO string — JSON has no Date type. */
export type User = {
  id: number;
  username: string;
  profilePicture: string | null;
  createdAt: string;
};

/** Shape of every non-2xx response body. */
export type ApiErrorBody = {
  error: string;
};
