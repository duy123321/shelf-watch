import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

const isLocal =
  env.DATABASE_URL.includes("localhost") ||
  env.DATABASE_URL.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  // Managed Postgres on Railway and Render terminates plaintext connections.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export const db = drizzle(pool, { schema });

export type Db = typeof db;
