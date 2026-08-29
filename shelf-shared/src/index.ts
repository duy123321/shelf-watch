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
