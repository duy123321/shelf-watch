import type { ReadStatus } from "@shelf-watch/shared";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { userReads } from "../db/schema.js";
import type { UserRead } from "./types.js";

/**
 * Changes the read status of one book on one user's shelf.
 *
 * Returns null when there's no `user_read` row for that (userId, bookId)
 * pair — either one doesn't exist, or that user never added that book.
 */
export async function updateReadStatus( input: {
  userId: number,
  bookId: number,
  status: ReadStatus,
}
): Promise<UserRead | null> {
  const [updated] = await db
    .update(userReads)
    .set({ status: input.status })
    .where(and(eq(userReads.userId, input.userId), eq(userReads.bookId, input.bookId)))
    .returning();

  return updated ?? null;
}
