import fp from "fastify-plugin";
import { db, pool, type Db } from "../db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
  }
}

/**
 * Exposes the Drizzle instance as `app.db` and drains the connection pool when
 * Fastify shuts down, so both SIGTERM and test teardown release handles.
 *
 * Must be wrapped in fastify-plugin — without it the decorator is scoped to
 * this plugin and every route fails at runtime with "app.db is undefined".
 */
export default fp(
  async (app) => {
    app.decorate("db", db);

    app.addHook("onClose", async () => {
      await pool.end();
    });
  },
  { name: "db" },
);
