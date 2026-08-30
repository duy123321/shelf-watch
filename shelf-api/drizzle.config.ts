import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // No `casing` option. Every table and column name is given explicitly in
  // src/db/schema.ts instead — including through the snake_case rename in
  // drizzle/0001_snake_case_naming.sql and 0002_users_plural.sql — so this
  // option would have nothing to do and no reason to be turned on.
});
