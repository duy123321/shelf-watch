---
name: backfill-book-covers
description: Fetch and store real cover art for books in the shelf-watch database from Open Library. Use when books are missing covers, showing placeholder/example.com covers, after seeding or adding new books, or when the user asks to "get covers", "fix the covers", "add book images", or "refresh cover art".
---

# Backfill book covers from Open Library

Populates `book.default_cover` and `book.covers` with real Open Library cover
URLs, matched by title + author.

## Run it

```bash
npm run db:covers
```

From the repo root. Only touches books that don't already have a real cover, so
it's safe to re-run after adding books — that's the normal case.

| Flag | Effect |
| --- | --- |
| *(none)* | Fetch covers for books that don't have one yet |
| `--dry-run` | Show what would change, write nothing |
| `--force` | Refetch every book, replacing existing covers |

Combine them: `npm run db:covers -- --force --dry-run`.

**The `--` is required.** The root script ends in a trailing `--` so arguments
forward into the workspace script. Without it npm swallows `--dry-run` as its
own flag and the script runs *for real* while looking like a dry run. If a
"dry run" reports `N updated` and the output does not say
`(--dry-run: nothing will be written)`, it wrote to the database.

Implementation: `shelf-api/src/db/backfill-covers.ts`.

## How matching works

1. Query `openlibrary.org/search.json` with `q={title} {author}`, requesting
   only the `key,title,author_name,cover_i` fields.
2. Take the first result that actually has a `cover_i`. The most relevant
   result is not always the one with cover art, so it scans the top 5 rather
   than giving up on the book.
3. Write `https://covers.openlibrary.org/b/id/{cover_i}-M.jpg` to
   `default_cover`, and `[M, L]` URLs to the `covers` JSON array.

`cover_i` is a **Cover ID**. That matters: Open Library rate-limits cover
lookups by ISBN, OCLC and LCCN to 100 requests per IP per 5 minutes, but
lookups by Cover ID and OLID are **not** rate-limited. Resolving once here
keeps every later image request on the unmetered path — which is why the URLs
are safe to render directly in a grid of many covers.

## Constraints worth knowing

- **Open Library search has no typo tolerance.** A misspelled title returns
  zero results, not a near match. The Solr fuzzy operator (`title~1`) doesn't
  help either — it also returns zero. Titles come from our own database here so
  it rarely bites, but it's why there's no fuzzy fallback when an exact query
  misses.
- **There are no rate-limit headers on `search.json`**, so there's no backoff
  signal — you'd discover a block by being blocked. The script stays
  deliberately slow (sequential, 250ms between requests) for that reason. Don't
  parallelise it.
- **Send a User-Agent.** Open Library asks automated clients to identify
  themselves and blocks unidentified heavy traffic. The script sets one; keep
  it set if you adapt this.
- **Not every book has art.** A book with no `cover_i` is reported as
  `no art` and left alone — that's a normal outcome, not a failure.

## Verifying

The script reports `N updated, N skipped, N without art`. To confirm the URLs
actually resolve rather than trusting the count:

```bash
docker compose exec -T postgres psql -U shelfwatch -d shelfwatch -c 'SELECT id, title, default_cover FROM book ORDER BY id;'
```

Then spot-check one — a real cover is a few KB of `image/jpeg`, and the URL
302-redirects to archive.org before serving:

```bash
curl -sL -o /dev/null -w '%{http_code} %{size_download}B %{content_type}\n' 'https://covers.openlibrary.org/b/id/10226290-M.jpg'
```

## Adding a book by hand

New rows need `default_cover` and `covers` to be `NOT NULL`, so insert a
placeholder and let the backfill replace it:

```sql
INSERT INTO book (title, author, default_cover, covers)
VALUES ('Some Title', 'Some Author', '', '[]'::jsonb);
```

Then `npm run db:covers`. The empty string doesn't start with the Open Library
prefix, so it counts as "no cover yet" and gets picked up.

## If you're changing this

Covers are currently stored as **URL strings**. The better shape is to store
the `cover_i` **integer** in its own column and derive URLs at render time —
that way moving to self-hosted/CDN images later is a code change instead of a
data migration. That's a schema migration nobody has done yet; if this script
starts growing, do that first.

Hotlinking Open Library covers is fine at current scale because Cover ID
lookups are unmetered and images come from the *viewer's* browser (their IP,
not the server's). For production you'd fetch once, content-address by
SHA-256, and serve from your own storage.
