import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { books } from "../db/schema.js";
import type { Book } from "./types.js";

/** The raw `book` row. `select()` with no column list — `Book` is the whole table. */
export async function getBook(bookId: number): Promise<Book | null> {
  const [book] = await db
    .select()
    .from(books)
    .where(eq(books.id, bookId))
    .limit(1);

  return book ?? null;
}
