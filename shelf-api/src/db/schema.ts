import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Table and column names are plain lowercase snake_case — the conventional,
 * unquoted Postgres naming. They originally inherited quoted PascalCase/
 * camelCase names from a Prisma migration; both sides were renamed together
 * in `drizzle/0001_snake_case_naming.sql`, a hand-written ALTER TABLE /
 * COLUMN / TYPE migration (not a generated create+drop), so existing rows
 * and ids survived the rename.
 *
 * JS property names stay camelCase on purpose — that's idiomatic TypeScript,
 * and it's why no file outside this one needed to change. Only the first
 * argument to each column/table helper (the actual SQL identifier) changed.
 *
 * The value list mirrors READ_STATUSES in @shelf-watch/shared; a test asserts
 * they stay equal.
 */
export const readStatus = pgEnum("read_status", [
  "TBR",
  "READING",
  "FINISHED",
  "DNF",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique("users_username_key"),
  // Nullable, unlike the Prisma schema. A required column with no default
  // cannot be backfilled and forces every insert to supply an avatar URL the
  // app has no source for. See MIGRATION_PLAN.md §0.1.
  profilePicture: text("profile_picture"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const books = pgTable("book", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  defaultCover: text("default_cover").notNull(),
  covers: jsonb("covers").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const userReads = pgTable(
  "user_read",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    cover: text("cover").notNull(),
    status: readStatus("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("user_read_user_id_book_id_key").on(t.userId, t.bookId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  reads: many(userReads),
}));

export const booksRelations = relations(books, ({ many }) => ({
  reads: many(userReads),
}));

export const userReadsRelations = relations(userReads, ({ one }) => ({
  user: one(users, { fields: [userReads.userId], references: [users.id] }),
  book: one(books, { fields: [userReads.bookId], references: [books.id] }),
}));
