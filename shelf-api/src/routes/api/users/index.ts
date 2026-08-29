import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  createUser,
  getUserShelf,
  getUserShelfSummary,
  listUsers,
} from "../../../services/users.js";

const usernameParams = z.object({ username: z.string().min(1) });

const createUserBody = z.object({
  username: z.string().min(1).max(64),
  profilePicture: z.string().url().optional(),
});

const PG_UNIQUE_VIOLATION = "23505";

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, cause } = err as { code?: string; cause?: unknown };
  if (code === PG_UNIQUE_VIOLATION) return true;
  return (
    typeof cause === "object" &&
    cause !== null &&
    (cause as { code?: string }).code === PG_UNIQUE_VIOLATION
  );
}

/**
 * Autoloaded at /api/users from this file's directory path — the route paths
 * below are relative to that prefix. Do not add a `prefix` option here, and do
 * not wrap this in fastify-plugin: route files keep their own scope.
 */
const usersRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async () => listUsers());

  app.post("/", async (req, reply) => {
    const parsed = createUserBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request body" });
    }

    try {
      const user = await createUser(parsed.data);
      return reply.status(201).send(user);
    } catch (err) {
      // 23505 = unique_violation. Previously an unhandled 500.
      //
      // Drizzle wraps driver errors in DrizzleQueryError, so the pg error code
      // is on `.cause`, not on the error itself. Check both — a future driver
      // or Drizzle version may stop wrapping.
      if (isUniqueViolation(err)) {
        return reply.status(409).send({ error: "Username already taken" });
      }
      throw err;
    }
  });

  app.get("/:username", async (req, reply) => {
    const { username } = usernameParams.parse(req.params);
    const summary = await getUserShelfSummary(username);
    if (!summary) return reply.status(404).send({ error: "User not found" });
    return summary;
  });

  app.get("/:username/books", async (req, reply) => {
    const { username } = usernameParams.parse(req.params);
    const shelf = await getUserShelf(username);
    if (!shelf) return reply.status(404).send({ error: "User not found" });
    // The bare array, matching the original route handler. Not { books: [...] }.
    return shelf.books;
  });
};

export default usersRoutes;
