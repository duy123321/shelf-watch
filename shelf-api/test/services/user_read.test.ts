import { READ_STATUSES } from "@shelf-watch/shared";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db, pool } from "../../src/db/client.js";
import { books, userReads, users } from "../../src/db/schema.js";
import { updateReadStatus } from "../../src/services/user_read.js";

/**
 * Service-level tests for user_read. Mirrors test/services/users.test.ts:
 * every test builds its own user + book + user_read rows with a recognisable
 * marker and tears them down in afterEach, so the seed fixtures the route
 * suites depend on are never mutated and files stay order-independent.
 *
 * Teardown order matters: user_read references book and users with
 * `onDelete: "restrict"`, so children go first.
 */

const createdUserIds: number[] = [];
const createdBookIds: number[] = [];

afterEach(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(userReads).where(inArray(userReads.userId, createdUserIds));
  }
  if (createdBookIds.length > 0) {
    await db.delete(books).where(inArray(books.id, createdBookIds));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  createdUserIds.length = 0;
  createdBookIds.length = 0;
});

afterAll(async () => {
  await pool.end();
});

const marker = () =>
  `urtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUser(): Promise<number> {
  const [row] = await db
    .insert(users)
    .values({ username: marker() })
    .returning({ id: users.id });
  createdUserIds.push(row!.id);
  return row!.id;
}

async function makeBook(): Promise<number> {
  const [row] = await db
    .insert(books)
    .values({
      title: marker(),
      author: "Test Author",
      defaultCover: "https://example.com/covers/test.jpg",
      covers: ["https://example.com/covers/test.jpg"],
    })
    .returning({ id: books.id });
  createdBookIds.push(row!.id);
  return row!.id;
}

/** A user + book + user_read triple, the read seeded at `status`. */
async function makeRead(status: (typeof READ_STATUSES)[number] = "TBR") {
  const userId = await makeUser();
  const bookId = await makeBook();
  const [read] = await db
    .insert(userReads)
    .values({
      userId,
      bookId,
      cover: "https://example.com/covers/owned.jpg",
      status,
    })
    .returning();
  return { userId, bookId, read: read! };
}

describe("updateReadStatus", () => {
  it("changes the status and returns the updated row", async () => {
    const { userId, bookId } = await makeRead("TBR");

    const updated = await updateReadStatus({ userId, bookId, status: "READING" });

    expect(updated).not.toBeNull();
    expect(updated).toMatchObject({ userId, bookId, status: "READING" });

    const [persisted] = await db
      .select({ status: userReads.status })
      .from(userReads)
      .where(and(eq(userReads.userId, userId), eq(userReads.bookId, bookId)));
    expect(persisted?.status).toBe("READING");
  });

  it("returns the shared UserRead shape — ISO string timestamps, cover normalised", async () => {
    // The service converts the raw row (Date columns, NOT NULL cover) to the
    // `@shelf-watch/shared` contract shape before returning.
    const { userId, bookId } = await makeRead("TBR");
    const updated = await updateReadStatus({ userId, bookId, status: "DNF" });
    expect(Object.keys(updated!).sort()).toEqual([
      "bookId",
      "cover",
      "createdAt",
      "id",
      "status",
      "updatedAt",
      "userId",
    ]);
    expect(updated!.createdAt).toBe(new Date(updated!.createdAt).toISOString());
    expect(updated!.updatedAt).toBe(new Date(updated!.updatedAt).toISOString());
    // makeRead seeds cover with a real URL; an empty string would come back null.
    expect(updated!.cover).toBe("https://example.com/covers/owned.jpg");
  });

  it("bumps updatedAt past the original", async () => {
    const { userId, bookId, read } = await makeRead("TBR");
    // $onUpdate fires on every .update(), so even a no-op status change moves
    // updatedAt.
    const updated = await updateReadStatus({ userId, bookId, status: "TBR" });
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(
      read.updatedAt.getTime(),
    );
  });

  it("round-trips every status in the shared contract", async () => {
    const { userId, bookId } = await makeRead("TBR");
    for (const status of READ_STATUSES) {
      const updated = await updateReadStatus({ userId, bookId, status });
      expect(updated!.status).toBe(status);
    }
  });

  it("returns null when no user_read row matches the pair", async () => {
    const userId = await makeUser();
    const bookId = await makeBook();
    // user and book exist, but the user never added the book.
    const result = await updateReadStatus({ userId, bookId, status: "READING" });
    expect(result).toBeNull();
  });

  it("does not insert a row when none matches", async () => {
    const userId = await makeUser();
    const bookId = await makeBook();
    await updateReadStatus({ userId, bookId, status: "READING" });

    const rows = await db
      .select()
      .from(userReads)
      .where(eq(userReads.userId, userId));
    expect(rows).toHaveLength(0);
  });

  it("only touches the matching (userId, bookId), not other users' reads of the same book", async () => {
    const { userId: userA, bookId } = await makeRead("TBR");
    const userB = await makeUser();
    const [readB] = await db
      .insert(userReads)
      .values({
        userId: userB,
        bookId,
        cover: "https://example.com/covers/owned-b.jpg",
        status: "FINISHED",
      })
      .returning();

    await updateReadStatus({ userId: userA, bookId, status: "DNF" });

    const [after] = await db
      .select({ status: userReads.status })
      .from(userReads)
      .where(eq(userReads.id, readB!.id));
    expect(after?.status).toBe("FINISHED");
  });
});
