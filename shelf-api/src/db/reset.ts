/**
 * Drops every table so `db:reset` can rebuild from migrations.
 *
 * Refuses to run against a non-local database — this is a development
 * convenience, not something that should ever touch a deployed environment.
 */
import { sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, pool } from "./client.js";

const isLocal =
  env.DATABASE_URL.includes("localhost") ||
  env.DATABASE_URL.includes("127.0.0.1");

async function main() {
  if (!isLocal) {
    console.error(
      "Refusing to reset a non-local database. DATABASE_URL must point at localhost.",
    );
    process.exit(1);
  }

  console.log("Dropping schema...");
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);

  // Drizzle keeps its migration journal in a separate "drizzle" schema. Without
  // dropping it too, the journal still lists every migration as applied and the
  // following db:migrate is a silent no-op — leaving an empty database.
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);

  console.log("Schema dropped.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
