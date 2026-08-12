import type { ShelfBook, ShelfSummary } from "@shelf-watch/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import BookList from "../components/BookList";
import StatusCounts from "../components/StatusCounts";
import { ApiError, getShelfBooks, getShelfSummary } from "../services/api";

/**
 * Replaces app/shelf/[username]/page.tsx.
 *
 * That page was a server component calling getUserShelf() directly, so loading
 * and not-found states came free from the framework. Over HTTP they have to be
 * explicit.
 */
export default function Shelf() {
  const { username = "" } = useParams();
  const [summary, setSummary] = useState<ShelfSummary | null>(null);
  const [books, setBooks] = useState<ShelfBook[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    Promise.all([getShelfSummary(username), getShelfBooks(username)])
      .then(([nextSummary, nextBooks]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setBooks(nextBooks);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  if (status === "loading") {
    return (
      <main>
        <p className="muted">Loading...</p>
      </main>
    );
  }

  if (status === "missing") {
    return (
      <main>
        <h1>User not found</h1>
        <p className="muted">
          No shelf for “{username}”. <Link to="/">Back to all users</Link>
        </p>
      </main>
    );
  }

  if (status === "error" || !summary || !books) {
    return (
      <main>
        <h1>Something went wrong</h1>
        <p className="muted">
          Could not load this shelf. <Link to="/">Back to all users</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <p className="muted">
        <Link to="/">← All users</Link>
      </p>
      <h1>{summary.username}</h1>
      <p className="muted">
        {summary.totalBooks} {summary.totalBooks === 1 ? "book" : "books"} on
        this shelf
      </p>

      <StatusCounts counts={summary.countsByStatus} />
      <BookList books={books} />
    </main>
  );
}
