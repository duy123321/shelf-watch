import { STATUS_LABELS, type ShelfBook } from "@shelf-watch/shared";

export default function BookList({ books }: { books: ShelfBook[] }) {
  if (books.length === 0) {
    return <p className="muted">No books yet.</p>;
  }

  return (
    <ul className="books">
      {books.map((book) => (
        <li key={book.id}>
          <span>
            <span className="title">{book.title}</span>{" "}
            <span className="muted">by {book.author}</span>
          </span>
          <span className="muted">{STATUS_LABELS[book.status]}</span>
        </li>
      ))}
    </ul>
  );
}
