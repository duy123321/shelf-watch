-- Hand-written, not `drizzle-kit generate` output.
--
-- `user` collides with a Postgres reserved word — it doubles as the
-- CURRENT_USER-style keyword, so `SELECT * FROM user` silently returns the
-- connected role name instead of erroring. Renaming to `users` (plural)
-- removes the collision entirely; every table is then quote-free in raw SQL,
-- which was the actual goal of 0001. All RENAMEs, no DROP/CREATE — rows,
-- ids, and foreign keys survive untouched.
--
-- Names below match a throwaway `drizzle-kit generate` against the updated
-- schema.ts, so a future `db:generate` diffs cleanly against them.
ALTER TABLE "user" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "users" RENAME CONSTRAINT "user_username_key" TO "users_username_key";--> statement-breakpoint
ALTER TABLE "user_read" RENAME CONSTRAINT "user_read_user_id_user_id_fk" TO "user_read_user_id_users_id_fk";--> statement-breakpoint
-- Cosmetic, same reasoning as the equivalent lines in 0001: not part of
-- Drizzle's schema diff, but left mismatched they're the one place the old
-- name would still show up in \d output.
ALTER TABLE "users" RENAME CONSTRAINT "user_pkey" TO "users_pkey";--> statement-breakpoint
ALTER SEQUENCE "user_id_seq" RENAME TO "users_id_seq";
