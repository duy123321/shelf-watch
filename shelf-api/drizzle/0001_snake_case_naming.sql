-- Hand-written, not `drizzle-kit generate` output.
--
-- Renames every identifier from the inherited quoted PascalCase/camelCase
-- (Prisma's convention) to plain lowercase snake_case (Postgres's own). Every
-- statement is a RENAME — no DROP, no CREATE — so existing rows, ids, and
-- foreign keys survive untouched; only the names change.
--
-- Constraint and foreign-key names below match what `drizzle-kit generate`
-- computes deterministically from the new schema.ts (verified against a
-- throwaway `drizzle-kit generate` run before writing this file), so a
-- future `db:generate` diffs cleanly against these names instead of seeing
-- drift and re-renaming them.
ALTER TYPE "ReadStatus" RENAME TO "read_status";--> statement-breakpoint
ALTER TABLE "User" RENAME TO "user";--> statement-breakpoint
ALTER TABLE "Book" RENAME TO "book";--> statement-breakpoint
ALTER TABLE "UserRead" RENAME TO "user_read";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "profilePicture" TO "profile_picture";--> statement-breakpoint
ALTER TABLE "user" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "book" RENAME COLUMN "defaultCover" TO "default_cover";--> statement-breakpoint
ALTER TABLE "book" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "user_read" RENAME COLUMN "userId" TO "user_id";--> statement-breakpoint
ALTER TABLE "user_read" RENAME COLUMN "bookId" TO "book_id";--> statement-breakpoint
ALTER TABLE "user_read" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "user_read" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "user" RENAME CONSTRAINT "User_username_key" TO "user_username_key";--> statement-breakpoint
ALTER TABLE "user_read" RENAME CONSTRAINT "UserRead_userId_User_id_fk" TO "user_read_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "user_read" RENAME CONSTRAINT "UserRead_bookId_Book_id_fk" TO "user_read_book_id_book_id_fk";--> statement-breakpoint
ALTER INDEX "UserRead_userId_bookId_key" RENAME TO "user_read_user_id_book_id_key";--> statement-breakpoint
-- Primary-key constraints and sequences aren't part of Drizzle's schema
-- diff, so renaming them is purely cosmetic housekeeping, not required for
-- generate/migrate to stay consistent — but left mismatched they're the one
-- place the old naming would still show up in \d output.
ALTER TABLE "user" RENAME CONSTRAINT "User_pkey" TO "user_pkey";--> statement-breakpoint
ALTER TABLE "book" RENAME CONSTRAINT "Book_pkey" TO "book_pkey";--> statement-breakpoint
ALTER TABLE "user_read" RENAME CONSTRAINT "UserRead_pkey" TO "user_read_pkey";--> statement-breakpoint
ALTER SEQUENCE "User_id_seq" RENAME TO "user_id_seq";--> statement-breakpoint
ALTER SEQUENCE "Book_id_seq" RENAME TO "book_id_seq";--> statement-breakpoint
ALTER SEQUENCE "UserRead_id_seq" RENAME TO "user_read_id_seq";
