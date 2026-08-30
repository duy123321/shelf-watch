/**
 * Fills in real cover art for every book, from Open Library.
 *
 * Resolves each book by title + author against Open Library's search API,
 * takes the `cover_i` (a Cover ID) off the best match, and writes the derived
 * image URLs into `book.default_cover` and `book.covers`.
 *
 * Why Cover IDs and not ISBNs: Open Library rate-limits cover lookups by
 * ISBN/OCLC/LCCN to 100 requests per IP per 5 minutes, but lookups by Cover ID
 * and OLID are not rate-limited. The search API hands back `cover_i` directly,
 * so resolving once here keeps every later image request on the unmetered path.
 *
 * Idempotent. Books that already have a real cover are skipped unless
 * `--force` is passed, so re-running after adding a few books only fetches
 * the new ones.
 *
 *   npm run db:covers -w shelf-api
 *   npm run db:covers -w shelf-api -- --force
 *   npm run db:covers -w shelf-api -- --dry-run
 */
import { eq } from "drizzle-orm";
import { pool, db } from "./client.js";
import { books } from "./schema.js";

/**
 * Open Library asks that automated clients identify themselves, and blocks
 * unidentified heavy traffic. Anything with a contact address is fine.
 */
const USER_AGENT = "shelf-watch/0.1 (+https://github.com/duy123321/shelf-watch)";

const SEARCH_URL = "https://openlibrary.org/search.json";
const COVER_URL = "https://covers.openlibrary.org/b/id";

/** Covers we wrote ourselves look like this; the seed's placeholders do not. */
const REAL_COVER_PREFIX = COVER_URL;

/**
 * Sequential requests with a gap between them. There is no published rate
 * limit on search.json — and no rate-limit headers to back off from — so the
 * safe play is to stay slow rather than discover the limit by being blocked.
 */
const DELAY_MS = 250;

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

type SearchDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function coverUrls(coverId: number) {
  return {
    // M is what the grid and dialog render; L is there so a detail view can
    // swap up without another round trip to Open Library.
    defaultCover: `${COVER_URL}/${coverId}-M.jpg`,
    covers: [`${COVER_URL}/${coverId}-M.jpg`, `${COVER_URL}/${coverId}-L.jpg`],
  };
}

/**
 * Best match for a title + author, or null when Open Library has the book but
 * no cover for it — which is common enough that it must not be treated as an
 * error.
 *
 * Note that Open Library's search has no typo tolerance at all: a misspelled
 * title returns zero results rather than a near match. Titles here come from
 * our own database, so that is not a concern, but it is why this cannot fall
 * back to fuzzy matching if the exact query misses.
 */
async function findCoverId(
  title: string,
  author: string,
): Promise<{ coverId: number; matchedTitle: string } | null> {
  const params = new URLSearchParams({
    q: `${title} ${author}`,
    limit: "5",
    fields: "key,title,author_name,cover_i",
  });

  const res = await fetch(`${SEARCH_URL}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Open Library search failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { docs?: SearchDoc[] };
  const docs = body.docs ?? [];

  // The first result is the most relevant, but the most relevant edition is
  // not always the one with cover art — take the first that actually has a
  // Cover ID rather than giving up on the whole book.
  const hit = docs.find((doc) => typeof doc.cover_i === "number");
  if (!hit?.cover_i) return null;

  return { coverId: hit.cover_i, matchedTitle: hit.title ?? title };
}

async function main() {
  const rows = await db
    .select({
      id: books.id,
      title: books.title,
      author: books.author,
      defaultCover: books.defaultCover,
    })
    .from(books)
    .orderBy(books.id);

  console.log(
    `${rows.length} book(s) in the database.${force ? " (--force: refetching all)" : ""}${
      dryRun ? " (--dry-run: nothing will be written)" : ""
    }`,
  );

  let updated = 0;
  let skipped = 0;
  let unmatched = 0;

  for (const row of rows) {
    const hasRealCover = row.defaultCover.startsWith(REAL_COVER_PREFIX);

    if (hasRealCover && !force) {
      console.log(`  skip    ${row.title} — already has a cover`);
      skipped += 1;
      continue;
    }

    let found: Awaited<ReturnType<typeof findCoverId>>;
    try {
      found = await findCoverId(row.title, row.author);
    } catch (err) {
      // One bad response should not abandon the rest of the shelf.
      console.error(`  ERROR   ${row.title} — ${(err as Error).message}`);
      unmatched += 1;
      await sleep(DELAY_MS);
      continue;
    }

    if (!found) {
      console.log(`  no art  ${row.title} — no Open Library cover found`);
      unmatched += 1;
      await sleep(DELAY_MS);
      continue;
    }

    const { defaultCover, covers } = coverUrls(found.coverId);

    if (!dryRun) {
      await db
        .update(books)
        .set({ defaultCover, covers })
        .where(eq(books.id, row.id));
    }

    const note =
      found.matchedTitle.toLowerCase() === row.title.toLowerCase()
        ? ""
        : ` (matched "${found.matchedTitle}")`;
    console.log(`  ok      ${row.title} — cover ${found.coverId}${note}`);
    updated += 1;

    await sleep(DELAY_MS);
  }

  console.log(
    `\nDone. ${updated} updated, ${skipped} skipped, ${unmatched} without art.`,
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
