import type { ReadStatus, UserRead } from "@shelf-watch/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { userReads } from "../db/schema.js";
import type { UserReadRow } from "./types.js";

/**
 * Converts a raw `user_read` row into the client-facing contract shape:
 * `Date` timestamps become ISO strings and the NOT NULL `cover` column's
 * empty string becomes `null` — the same normalisation `listUsers()` applies
 * to `User`.
 */
function toUserRead(row: UserReadRow): UserRead {
  return {
    id: row.id,
    userId: row.userId,
    bookId: row.bookId,
    status: row.status,
    cover: row.cover || null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Changes the read status of one book on one user's shelf.
 *
 * Returns null when there's no `user_read` row for that (userId, bookId)
 * pair — either one doesn't exist, or that user never added that book.
 */
export async function updateReadStatus(input: {
  userId: number;
  bookId: number;
  status: ReadStatus;
}): Promise<UserRead | null> {
  const [updated] = await db
    .update(userReads)
    .set({ status: input.status })
    .where(
      and(
        eq(userReads.userId, input.userId),
        eq(userReads.bookId, input.bookId),
      ),
    )
    .returning();

  return updated ? toUserRead(updated) : null;
}
