import type { ShelfBook } from "@shelf-watch/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BookCover from "./BookCover";
import StatusBadge from "./StatusBadge";

/**
 * One book on a shelf. Shared so the shelf page can drop the hand-rolled
 * BookList for this once it is ported off the pre-shadcn styles.
 *
 * The whole card is the click target for the detail dialog. It is a real
 * <button> rather than a click handler on the Card so it is keyboard
 * reachable and announced as activatable, which a div with onClick is not.
 */
export default function BookCard({
  book,
  onSelect,
}: {
  book: ShelfBook;
  onSelect: (book: ShelfBook) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(book)}
      aria-label={`Open details for ${book.title}`}
      // The global unlayered `button` rule in index.css sets padding, border
      // and background on every button; the `!` modifiers strip them back off
      // so this reads as a card, not a chrome button.
      className="group border-0! bg-transparent! p-0! text-left focus-visible:outline-none"
    >
      <Card className="h-full gap-3 py-4 transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardHeader className="px-4">
          <BookCover
            src={book.cover}
            title={book.title}
            className="mb-3 aspect-2/3 w-full rounded-sm"
          />
          <CardTitle className="text-sm leading-snug">{book.title}</CardTitle>
          <p className="text-xs text-muted-foreground">{book.author}</p>
        </CardHeader>
        <CardContent className="px-4">
          <StatusBadge status={book.status} />
        </CardContent>
      </Card>
    </button>
  );
}
