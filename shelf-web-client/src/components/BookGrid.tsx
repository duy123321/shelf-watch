import type { ShelfBook } from "@shelf-watch/shared";
import BookCard from "./BookCard";

/**
 * The books column: a 3-up grid of BookCards, or an empty-state line.
 * Owns nothing but layout for now — a natural home for a per-list fetch or
 * loading state if the books view ever splits off from the page load.
 */
export default function BookGrid({
  books,
  onSelect,
}: {
  books: ShelfBook[];
  onSelect: (book: ShelfBook) => void;
}) {
  if (books.length === 0) {
    return <p className="text-sm text-muted-foreground">No books yet.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => (
        <BookCard key={book.id} book={book} onSelect={onSelect} />
      ))}
    </div>
  );
}
