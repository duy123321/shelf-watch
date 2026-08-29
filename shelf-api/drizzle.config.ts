import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // No `casing` option on purpose. It only accepts "snake_case" | "camelCase",
  // and both would rewrite the identifiers. Every table and column name is
  // given explicitly in src/db/schema.ts, which preserves the quoted
  // PascalCase/camelCase names Prisma created.
});
