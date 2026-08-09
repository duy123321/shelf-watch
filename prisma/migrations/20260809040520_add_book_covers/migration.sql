/*
  Warnings:

  - Added the required column `covers` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `defaultCover` to the `Book` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cover` to the `UserRead` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "defaultCover" TEXT NOT NULL,
    "covers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Book" ("author", "createdAt", "id", "title") SELECT "author", "createdAt", "id", "title" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE TABLE "new_UserRead" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "bookId" INTEGER NOT NULL,
    "cover" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserRead_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_UserRead" ("bookId", "createdAt", "id", "status", "updatedAt", "userId") SELECT "bookId", "createdAt", "id", "status", "updatedAt", "userId" FROM "UserRead";
DROP TABLE "UserRead";
ALTER TABLE "new_UserRead" RENAME TO "UserRead";
CREATE UNIQUE INDEX "UserRead_userId_bookId_key" ON "UserRead"("userId", "bookId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
