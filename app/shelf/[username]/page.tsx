import { notFound } from "next/navigation";
import { ReadStatus } from "@/app/generated/prisma/enums";
import { getUserShelf } from "@/lib/services/users";

const STATUS_LABELS: Record<ReadStatus, string> = {
  TBR: "To read",
  READING: "Reading",
  FINISHED: "Finished",
  DNF: "Did not finish",
};

export default async function ShelfPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const shelf = await getUserShelf(username);

  if (!shelf) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{shelf.username}</h1>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {shelf.totalBooks} {shelf.totalBooks === 1 ? "book" : "books"} on this
        shelf
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.values(ReadStatus).map((status) => (
          <div
            key={status}
            className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
          >
            <dt className="text-xs text-gray-500 dark:text-gray-400">
              {STATUS_LABELS[status]}
            </dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">
              {shelf.countsByStatus[status]}
            </dd>
          </div>
        ))}
      </dl>

      {shelf.books.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-400">
          No books yet.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-gray-200 dark:divide-gray-800">
          {shelf.books.map((book) => (
            <li
              key={book.id}
              className="flex items-baseline justify-between gap-4 py-3"
            >
              <span>
                <span className="font-medium">{book.title}</span>{" "}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  by {book.author}
                </span>
              </span>
              <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                {STATUS_LABELS[book.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
