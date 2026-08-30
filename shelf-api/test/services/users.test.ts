import { READ_STATUSES } from "@shelf-watch/shared";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db, pool } from "../../src/db/client.js";
import { books, userReads, users } from "../../src/db/schema.js";
import {
  createUser,
  getUserShelf,
  getUserShelfSummary,
  listUsers,
} from "../../src/services/users.js";

/**
 * Service-level tests: exercise the exported functions directly against the
 * local Postgres, without going through Fastify. The route/resolver behaviour
 * (status codes, error envelopes, the bare-array response) lives in
 * test/routes/users.test.ts instead.
 *
 * Convention for the userReads suite to mirror:
 *   - Read-only assertions lean on the seed fixtures (duy / priya / sam).
 *   - Anything that writes creates its own rows with a recognisable marker and
 *     removes them in afterEach, so the suite stays order-independent and the
 *     seed dataset the other tests rely on is never mutated.
 *   - user_read / book both use `onDelete: "restrict"`, so tear down children
 *     before parents.
 */

// Usernames minted by tests here; cleaned up after each test.
const createdUsernames: string[] = [];

afterEach(async () => {
  if (createdUsernames.length === 0) return;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.username, createdUsernames));
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    await db.delete(userReads).where(inArray(userReads.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
  createdUsernames.length = 0;
});

afterAll(async () => {
  // Drain the pool or Vitest hangs — the route suite closes the Fastify app
  // for the same reason.
  await pool.end();
});

async function makeUser(overrides?: {
  username?: string;
  profilePicture?: string;
}) {
  const username = overrides?.username ?? `svc-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  createdUsernames.push(username);
  return createUser({ username, profilePicture: overrides?.profilePicture });
}

describe("listUsers", () => {
  it("returns the seeded users ordered by id", async () => {
    const rows = await listUsers();
    const seeded = rows
      .map((r) => r.username)
      .filter((u) => ["duy", "priya", "sam"].includes(u));
    expect(seeded).toEqual(["duy", "priya", "sam"]);
  });

  it("exposes exactly the four whitelisted columns", async () => {
    const [row] = await listUsers();
    expect(Object.keys(row).sort()).toEqual([
      "createdAt",
      "id",
      "profilePicture",
      "username",
    ]);
  });

  it("serialises createdAt as an ISO string, not a Date", async () => {
    const [row] = await listUsers();
    expect(typeof row.createdAt).toBe("string");
    expect(row.createdAt).toBe(new Date(row.createdAt).toISOString());
  });

  it("carries profilePicture through verbatim (null and set)", async () => {
    const rows = await listUsers();
    const byName = new Map(rows.map((r) => [r.username, r]));
    expect(byName.get("duy")?.profilePicture).toBeNull();
    expect(byName.get("priya")?.profilePicture).toBe(
      "https://example.com/avatars/priya.png",
    );
  });

  it("includes users created through the service", async () => {
    const user = await makeUser();
    const usernames = (await listUsers()).map((r) => r.username);
    expect(usernames).toContain(user.username);
  });
});

describe("createUser", () => {
  it("returns the row with an ISO createdAt and null profilePicture by default", async () => {
    const user = await makeUser();
    expect(user).toMatchObject({ profilePicture: null });
    expect(typeof user.id).toBe("number");
    expect(user.createdAt).toBe(new Date(user.createdAt).toISOString());
  });

  it("persists a supplied profilePicture", async () => {
    const url = "https://example.com/avatars/new.png";
    const user = await makeUser({ profilePicture: url });
    expect(user.profilePicture).toBe(url);

    const [persisted] = await db
      .select({ profilePicture: users.profilePicture })
      .from(users)
      .where(eq(users.id, user.id));
    expect(persisted?.profilePicture).toBe(url);
  });

  it("normalises an omitted profilePicture to SQL NULL", async () => {
    const user = await makeUser();
    const [persisted] = await db
      .select({ profilePicture: users.profilePicture })
      .from(users)
      .where(eq(users.id, user.id));
    expect(persisted?.profilePicture).toBeNull();
  });

  it("rejects a duplicate username (unique violation bubbles up)", async () => {
    await expect(createUser({ username: "duy" })).rejects.toThrow();
  });
});

describe("getUserShelfSummary", () => {
  it("returns null for an unknown username", async () => {
    expect(await getUserShelfSummary("nobody")).toBeNull();
  });

  it("distinguishes an empty shelf (sam) from a missing user", async () => {
    const summary = await getUserShelfSummary("sam");
    expect(summary).not.toBeNull();
    expect(summary?.totalBooks).toBe(0);
  });

  it("zero-fills every status and keeps totalBooks a number", async () => {
    const summary = await getUserShelfSummary("priya");
    expect(Object.keys(summary!.countsByStatus).sort()).toEqual(
      [...READ_STATUSES].sort(),
    );
    expect(summary!.countsByStatus).toEqual({
      TBR: 0,
      READING: 2,
      FINISHED: 0,
      DNF: 0,
    });
    expect(typeof summary!.totalBooks).toBe("number");
    expect(summary!.totalBooks).toBe(2);
  });

  it("counts a book in every status for duy", async () => {
    const summary = await getUserShelfSummary("duy");
    expect(summary!.countsByStatus).toEqual({
      TBR: 1,
      READING: 1,
      FINISHED: 1,
      DNF: 1,
    });
    expect(summary!.totalBooks).toBe(4);
  });

  it("echoes back the canonical username", async () => {
    const summary = await getUserShelfSummary("duy");
    expect(summary!.username).toBe("duy");
  });
});

describe("getUserShelf", () => {
  it("returns null for an unknown username", async () => {
    expect(await getUserShelf("nobody")).toBeNull();
  });

  it("returns an empty shelf for sam without going null", async () => {
    const shelf = await getUserShelf("sam");
    expect(shelf).not.toBeNull();
    expect(shelf?.books).toEqual([]);
    expect(shelf?.totalBooks).toBe(0);
  });

  it("returns every book with the whitelisted fields", async () => {
    const shelf = await getUserShelf("duy");
    expect(shelf!.books).toHaveLength(4);
    for (const book of shelf!.books) {
      expect(Object.keys(book).sort()).toEqual([
        "author",
        "cover",
        "id",
        "status",
        "title",
      ]);
    }
  });

  it("orders books by updatedAt descending", async () => {
    const shelf = await getUserShelf("duy");
    // Piranesi has the most recent updatedAt in the seed (1 minute ago).
    expect(shelf!.books[0]!.title).toBe("Piranesi");
    expect(shelf!.books.at(-1)!.title).toBe("Gödel, Escher, Bach");
  });

  it("derives countsByStatus from the loaded rows, fully zero-filled", async () => {
    const shelf = await getUserShelf("duy");
    expect(shelf!.countsByStatus).toEqual({
      TBR: 1,
      READING: 1,
      FINISHED: 1,
      DNF: 1,
    });
    const summed = Object.values(shelf!.countsByStatus).reduce((a, b) => a + b, 0);
    expect(summed).toBe(shelf!.totalBooks);
  });

  it("uses the book-level cover, not the per-user override column", async () => {
    const shelf = await getUserShelf("priya");
    const piranesi = shelf!.books.find((b) => b.title === "Piranesi");
    // seed sets user_read.cover to a `-owned.jpg` URL; the response must show
    // book.default_cover instead.
    expect(piranesi?.cover).toBe("https://example.com/covers/piranesi-1.jpg");
  });

  it("normalises an empty-string cover to null", async () => {
    // book.default_cover is NOT NULL, so 'no cover' is stored as ''. Build a
    // throwaway user + book + read to hit that branch, then tear it down.
    const user = await makeUser();
    const [book] = await db
      .insert(books)
      .values({
        title: `no-cover-${user.username}`,
        author: "Nobody",
        defaultCover: "",
        covers: [],
      })
      .returning({ id: books.id });
    try {
      await db.insert(userReads).values({
        userId: user.id,
        bookId: book!.id,
        cover: "",
        status: "TBR",
      });

      const shelf = await getUserShelf(user.username);
      expect(shelf!.books).toHaveLength(1);
      expect(shelf!.books[0]!.cover).toBeNull();
    } finally {
      await db.delete(userReads).where(eq(userReads.bookId, book!.id));
      await db.delete(books).where(eq(books.id, book!.id));
    }
  });
});
