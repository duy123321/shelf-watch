/**
 * Seeds a known-good dataset. Idempotent — safe to run repeatedly.
 *
 * There is no data migration from the old SQLite database, so this is the only
 * source of local and CI data. The fixtures are chosen to exercise every
 * branch the API can take:
 *
 *   duy      books in all four statuses  -> countsByStatus with no zeroes
 *   priya    books in one status only    -> the zero-fill guarantee
 *   sam      no books at all             -> empty shelf != missing user
 *   "nobody" never seeded                -> the 404 path
 */
import { eq } from "drizzle-orm";
import { pool, db } from "./client.js";
import { books, userReads, users } from "./schema.js";

const USERS = [
  { username: "duy", profilePicture: null },
  { username: "priya", profilePicture: "https://example.com/avatars/priya.png" },
  { username: "sam", profilePicture: null },
];

const BOOKS = [
  {
    title: "The Left Hand of Darkness",
    author: "Ursula K. Le Guin",
    defaultCover: "https://example.com/covers/lhod-1.jpg",
    covers: ["https://example.com/covers/lhod-1.jpg"],
  },
  {
    title: "Piranesi",
    author: "Susanna Clarke",
    defaultCover: "https://example.com/covers/piranesi-1.jpg",
    covers: ["https://example.com/covers/piranesi-1.jpg"],
  },
  {
    title: "The Blade Itself",
    author: "Joe Abercrombie",
    defaultCover: "https://example.com/covers/blade-1.jpg",
    covers: ["https://example.com/covers/blade-1.jpg"],
  },
  {
    title: "Gödel, Escher, Bach",
    author: "Douglas Hofstadter",
    defaultCover: "https://example.com/covers/geb-1.jpg",
    covers: ["https://example.com/covers/geb-1.jpg"],
  },
  {
    title: "A Memory Called Empire",
    author: "Arkady Martine",
    defaultCover: "https://example.com/covers/amce-1.jpg",
    covers: ["https://example.com/covers/amce-1.jpg"],
  },
];

/** [username, book title, status, minutes-ago for updatedAt] */
const READS: Array<[string, string, "TBR" | "READING" | "FINISHED" | "DNF", number]> = [
  ["duy", "The Left Hand of Darkness", "FINISHED", 5],
  ["duy", "Piranesi", "READING", 1],
  ["duy", "The Blade Itself", "TBR", 60],
  ["duy", "Gödel, Escher, Bach", "DNF", 240],
  ["priya", "A Memory Called Empire", "READING", 10],
  ["priya", "Piranesi", "READING", 30],
];

async function main() {
  console.log("Seeding...");

  await db
    .insert(users)
    .values(USERS)
    .onConflictDoNothing({ target: users.username });

  // Book has no unique constraint, so guard on title to stay idempotent.
  for (const book of BOOKS) {
    const [existing] = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.title, book.title))
      .limit(1);
    if (!existing) await db.insert(books).values(book);
  }

  const userRows = await db
    .select({ id: users.id, username: users.username })
    .from(users);
  const bookRows = await db
    .select({ id: books.id, title: books.title })
    .from(books);

  const userId = new Map(userRows.map((u) => [u.username, u.id]));
  const bookId = new Map(bookRows.map((b) => [b.title, b.id]));

  const now = Date.now();
  const readValues = READS.map(([username, title, status, minutesAgo]) => {
    const uid = userId.get(username);
    const bid = bookId.get(title);
    if (uid === undefined || bid === undefined) {
      throw new Error(`Seed reference missing: ${username} / ${title}`);
    }
    return {
      userId: uid,
      bookId: bid,
      cover: `https://example.com/covers/${bid}-owned.jpg`,
      status,
      // Distinct timestamps so the updatedAt DESC ordering is observable.
      updatedAt: new Date(now - minutesAgo * 60_000),
    };
  });

  await db.insert(userReads).values(readValues).onConflictDoNothing();

  const [{ n: userCount } = { n: 0 }] = await db
    .select({ n: users.id })
    .from(users)
    .then((r) => [{ n: r.length }]);

  console.log(
    `Done. ${userCount} users, ${bookRows.length} books, ${readValues.length} reads.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
