import { READ_STATUSES } from "@shelf-watch/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { readStatus } from "../../src/db/schema.js";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

afterAll(async () => {
  // Triggers the onClose hook that drains the pg pool; without it Vitest hangs.
  await app.close();
});

describe("contract", () => {
  it("keeps the Drizzle enum in sync with the shared contract", () => {
    expect(readStatus.enumValues).toEqual([...READ_STATUSES]);
  });

  it("registers exactly the expected routes", () => {
    const tree = app.printRoutes();
    expect(tree).toContain("health");
    expect(tree).toContain("users");
  });
});

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /api/users", () => {
  it("returns the seeded users with explicit columns", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(body[0]).sort()).toEqual([
      "createdAt",
      "id",
      "profilePicture",
      "username",
    ]);
  });
});

describe("POST /api/users", () => {
  it("rejects an empty body with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Invalid request body" });
  });

  it("rejects a duplicate username with 409", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { username: "duy" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "Username already taken" });
  });

  it("creates a user with 201", async () => {
    const username = `test-${Date.now()}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      payload: { username },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ username, profilePicture: null });
  });
});

describe("GET /api/users/:username", () => {
  it("zero-fills every status for a user with books in one status", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/priya" });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(Object.keys(body.countsByStatus).sort()).toEqual(
      [...READ_STATUSES].sort(),
    );
    expect(body.countsByStatus.READING).toBe(2);
    expect(body.countsByStatus.TBR).toBe(0);
    expect(body.countsByStatus.FINISHED).toBe(0);
    expect(body.countsByStatus.DNF).toBe(0);
  });

  it("returns totalBooks as a number, not a string", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/duy" });
    const body = res.json();
    expect(typeof body.totalBooks).toBe("number");
    expect(body.totalBooks).toBe(4);
  });

  it("distinguishes an empty shelf from a missing user", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/sam" });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalBooks).toBe(0);
  });

  it("404s for an unknown username", async () => {
    const res = await app.inject({ method: "GET", url: "/api/users/nobody" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "User not found" });
  });
});

describe("GET /api/users/:username/books", () => {
  it("returns a bare array, not an object", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users/duy/books",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(4);
    expect(Object.keys(body[0]).sort()).toEqual([
      "author",
      "id",
      "status",
      "title",
    ]);
  });

  it("orders by updatedAt descending", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users/duy/books",
    });
    // Piranesi has the most recent updatedAt in the seed.
    expect(res.json()[0].title).toBe("Piranesi");
  });

  it("404s for an unknown username", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/users/nobody/books",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "User not found" });
  });
});
