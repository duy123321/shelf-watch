CREATE TYPE "public"."ReadStatus" AS ENUM('TBR', 'READING', 'FINISHED', 'DNF');--> statement-breakpoint
CREATE TABLE "Book" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"defaultCover" text NOT NULL,
	"covers" jsonb NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "UserRead" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"bookId" integer NOT NULL,
	"cover" text NOT NULL,
	"status" "ReadStatus" NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"profilePicture" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_username_key" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "UserRead" ADD CONSTRAINT "UserRead_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "UserRead" ADD CONSTRAINT "UserRead_bookId_Book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."Book"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "UserRead_userId_bookId_key" ON "UserRead" USING btree ("userId","bookId");