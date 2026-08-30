import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { db } from "../../src/db/client.js";
import { books, userReads, users } from "../../src/db/schema.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  await app.close();
});

// Fixtures created per test, torn down after. Children (user_read) before
// parents — both FKs are `onDelete: "restrict"`.
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

const marker = () =>
  `urroute-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeRead(status = "TBR") {
  const [u] = await db
    .insert(users)
    .values({ username: marker() })
    .returning({ id: users.id });
  createdUserIds.push(u!.id);
  const [b] = await db
    .insert(books)
    .values({
      title: marker(),
      author: "Test Author",
      defaultCover: "https://example.com/covers/test.jpg",
      covers: ["https://example.com/covers/test.jpg"],
    })
    .returning({ id: books.id });
  createdBookIds.push(b!.id);
  await db.insert(userReads).values({
    userId: u!.id,
    bookId: b!.id,
    cover: "https://example.com/covers/owned.jpg",
    status: status as "TBR",
  });
  return { userId: u!.id, bookId: b!.id };
}

function patch(payload: unknown) {
  return app.inject({ method: "PATCH", url: "/api/user-reads/", payload });
}

describe("routing", () => {
  it("registers PATCH /api/user-reads/", () => {
    expect(app.hasRoute({ method: "PATCH", url: "/api/user-reads/" })).toBe(true);
  });
});

describe("PATCH /api/user-reads — validation", () => {
  it("rejects an empty body with 400 and the standard error envelope", async () => {
    const res = await patch({});
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Invalid request body" });
  });

  it("rejects a missing status", async () => {
    const res = await patch({ userId: 1, bookId: 1 });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a status outside READ_STATUSES", async () => {
    const res = await patch({ userId: 1, bookId: 1, status: "READ" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a non-integer id (z.int)", async () => {
    const res = await patch({ userId: 1.5, bookId: 1, status: "TBR" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a stringified id (no coercion)", async () => {
    const res = await patch({ userId: "1", bookId: "2", status: "TBR" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects ids below 1", async () => {
    const res = await patch({ userId: 0, bookId: 1, status: "TBR" });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/user-reads — updates", () => {
  it("updates an existing read and echoes back the user_read row (no book fields)", async () => {
    const { userId, bookId } = await makeRead("TBR");

    const res = await patch({ userId, bookId, status: "READING" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ userId, bookId, status: "READING" });
    // The shared UserRead shape — read record only, never title/author.
    expect(Object.keys(res.json()).sort()).toEqual([
      "bookId",
      "cover",
      "createdAt",
      "id",
      "status",
      "updatedAt",
      "userId",
    ]);
  });

  it("serialises the timestamps as ISO strings, with updatedAt bumped", async () => {
    const { userId, bookId } = await makeRead("TBR");

    const res = await patch({ userId, bookId, status: "FINISHED" });
    const body = res.json();

    expect(typeof body.createdAt).toBe("string");
    expect(typeof body.updatedAt).toBe("string");
    expect(body.createdAt).toBe(new Date(body.createdAt).toISOString());
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(body.createdAt).getTime(),
    );
  });

  it("persists the change", async () => {
    const { userId, bookId } = await makeRead("TBR");
    await patch({ userId, bookId, status: "DNF" });

    const res2 = await patch({ userId, bookId, status: "DNF" });
    expect(res2.json().status).toBe("DNF");
  });

  it("404s with the standard envelope when no user_read row matches", async () => {
    const { userId } = await makeRead("TBR");
    const res = await patch({ userId, bookId: 2_000_000_000, status: "TBR" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: `User ${userId} did not read book 2000000000`,
    });
  });
});
