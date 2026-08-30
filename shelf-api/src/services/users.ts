import {
  READ_STATUSES,
  type Shelf,
  type ShelfBook,
  type ShelfSummary,
  type StatusCounts,
  type User,
} from "@shelf-watch/shared";
import { count, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { books, userReads, users } from "../db/schema.js";

/**
 * Every status seeded to 0, derived from the shared contract so a new status
 * shows up automatically instead of being silently missing from responses.
 */
function emptyCounts(): StatusCounts {
  return Object.fromEntries(
    READ_STATUSES.map((status) => [status, 0]),
  ) as StatusCounts;
}

/** Explicit column list — a future column is never leaked by accident. */
export async function listUsers(): Promise<User[]> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      profilePicture: users.profilePicture,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.id);

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createUser(input: {
  username: string;
  profilePicture?: string | undefined;
}): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      username: input.username,
      profilePicture: input.profilePicture ?? null,
    })
    .returning({
      id: users.id,
      username: users.username,
      profilePicture: users.profilePicture,
      createdAt: users.createdAt,
    });

  // .returning() on a successful single insert always yields one row; the
  // guard exists to satisfy noUncheckedIndexedAccess.
  if (!row) throw new Error("Insert returned no row");

  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * Counts only, without loading any book rows. Use when the caller needs totals
 * but not the books themselves.
 *
 * Returns null if the username doesn't exist, which callers should distinguish
 * from a user whose shelf is simply empty.
 */
export async function getUserShelfSummary(
  username: string,
): Promise<ShelfSummary | null> {
  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) return null;

  // Unlike the Prisma version this can't run concurrently with the lookup
  // above — the aggregate needs user.id, which the lookup produces.
  const grouped = await db
    .select({ status: userReads.status, n: count() })
    .from(userReads)
    .where(eq(userReads.userId, user.id))
    .groupBy(userReads.status);

  const countsByStatus = emptyCounts();
  let totalBooks = 0;
  for (const row of grouped) {
    // count() comes back as a JS number via the pg type parser, but COUNT() is
    // bigint in Postgres — Number() keeps totalBooks a sum, not a concatenation.
    const n = Number(row.n);
    countsByStatus[row.status] = n;
    totalBooks += n;
  }

  return { username: user.username, totalBooks, countsByStatus };
}

/**
 * Books plus counts. Derives the counts from the rows it already loaded rather
 * than issuing a second aggregate query.
 *
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
      // book.default_cover, not user_read.cover. The per-user column is an
      // override for "which edition's jacket do I see", which nothing sets
      // yet; the book-level column is what `npm run db:covers` fills in.
      cover: books.defaultCover,
    })
    .from(userReads)
    .innerJoin(books, eq(userReads.bookId, books.id))
    .where(eq(userReads.userId, user.id))
    .orderBy(desc(userReads.updatedAt));

  const countsByStatus = emptyCounts();
  for (const row of rows) {
    countsByStatus[row.status] += 1;
  }

  const shelfBooks: ShelfBook[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    status: row.status,
    // The column is NOT NULL, so "no cover" arrives as an empty string.
    cover: row.cover || null,
  }));

  return {
    username: user.username,
    totalBooks: shelfBooks.length,
    countsByStatus,
    books: shelfBooks,
  };
}
