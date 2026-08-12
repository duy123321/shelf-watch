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
 * Table and column names are quoted PascalCase/camelCase to match what Prisma
 * created. Do not "fix" them to snake_case — the names are the contract with
 * the existing migration history.
 *
 * The value list mirrors READ_STATUSES in @shelf-watch/shared; a test asserts
 * they stay equal.
 */
export const readStatus = pgEnum("ReadStatus", [
  "TBR",
  "READING",
  "FINISHED",
  "DNF",
]);

export const users = pgTable("User", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique("User_username_key"),
  // Nullable, unlike the Prisma schema. A required column with no default
  // cannot be backfilled and forces every insert to supply an avatar URL the
  // app has no source for. See MIGRATION_PLAN.md §0.1.
  profilePicture: text("profilePicture"),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const books = pgTable("Book", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  defaultCover: text("defaultCover").notNull(),
  covers: jsonb("covers").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const userReads = pgTable(
  "UserRead",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    bookId: integer("bookId")
      .notNull()
      .references(() => books.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    cover: text("cover").notNull(),
    status: readStatus("status").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("UserRead_userId_bookId_key").on(t.userId, t.bookId)],
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
