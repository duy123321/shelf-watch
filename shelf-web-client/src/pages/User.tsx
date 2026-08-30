import {
  READ_STATUSES,
  type ReadStatus,
  type ShelfBook,
  type ShelfSummary,
  type StatusCounts,
  type User as UserRecord,
} from "@shelf-watch/shared";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import BookDialog from "../components/BookDialog";
import BookGrid from "../components/BookGrid";
import ProfileCard from "../components/ProfileCard";
import StreakCard from "../components/StreakCard";
import {
  ApiError,
  getShelfBooks,
  getShelfSummary,
  getUsers,
  updateBookStatus,
} from "../services/api";

/**
 * Recomputes the status tallies from the books already in hand, so the
 * profile card stays in step with an edit without a second round trip.
 * Seeded from READ_STATUSES so every status is present at zero, matching the
 * API's own zero-fill guarantee.
 */
function countBooks(books: ShelfBook[]): StatusCounts {
  const counts = Object.fromEntries(
    READ_STATUSES.map((status) => [status, 0]),
  ) as StatusCounts;
  for (const book of books) counts[book.status] += 1;
  return counts;
}

// The route carries a numeric id but every shelf endpoint is keyed by
// username, so the id is resolved through /api/users first.
async function loadUser(userId: string) {
  const users = await getUsers();
  const user = users.find((candidate) => String(candidate.id) === userId);
  if (!user) throw new ApiError(404, "User not found");

  const [summary, books] = await Promise.all([
    getShelfSummary(user.username),
    getShelfBooks(user.username),
  ]);

  return { user, summary, books };
}

type Loaded = {
  user: UserRecord;
  summary: ShelfSummary;
  books: ShelfBook[];
};

export default function User() {
  const { userId = "" } = useParams<{ userId: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState<ShelfBook | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );

  /**
   * Persists first, then folds the returned `user_read` row's new status into
   * the book already in hand — no optimistic update, so a rejected change
   * never briefly appears to have worked. Only `status` changes; `title` and
   * `author` come from the immutable book row. Throwing propagates to the
   * dialog, which shows the message inline.
   */
  async function handleSave(book: ShelfBook, next: ReadStatus) {
    if (!data) return;

    const saved = await updateBookStatus(data.user.id, book.id, next);

    setData((current) => {
      if (!current) return current;
      const books = current.books.map((candidate) =>
        // `saved.id` is the user_read row id — match on the book id instead.
        candidate.id === saved.bookId
          ? { ...candidate, status: saved.status }
          : candidate,
      );
      return {
        ...current,
        books,
        summary: { ...current.summary, countsByStatus: countBooks(books) },
      };
    });

    setSelected(null);
  }

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");

    loadUser(userId)
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 404 ? "missing" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (status !== "ready" || !data) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-6xl! px-6! py-16!">
          <p className="text-sm text-muted-foreground">
            {status === "loading"
              ? "Loading…"
              : status === "missing"
                ? "No such user."
                : "Could not load this profile."}
          </p>
        </main>
      </div>
    );
  }

  const { user, summary, books } = data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/*
        The `!` modifiers override the unlayered global `main { max-width: 42rem }`
        in index.css, which the pre-shadcn pages still rely on. Tailwind utilities
        live in @layer utilities and would otherwise lose to it.
      */}
      <main className="mx-auto grid max-w-6xl! gap-6 px-6! py-12! md:grid-cols-[20rem_1fr] md:items-start">
        <div className="flex flex-col gap-6">
          <ProfileCard user={user} summary={summary} />
          <StreakCard />
        </div>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Books</h2>
          <BookGrid books={books} onSelect={setSelected} />
        </section>
      </main>

      <BookDialog
        book={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
