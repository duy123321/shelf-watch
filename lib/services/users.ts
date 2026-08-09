import { ReadStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type StatusCounts = Record<ReadStatus, number>;

export type ShelfSummary = {
  username: string;
  totalBooks: number;
  countsByStatus: StatusCounts;
};

export type ShelfBook = {
  id: number;
  title: string;
  author: string;
  status: ReadStatus;
};

export type Shelf = ShelfSummary & {
  books: ShelfBook[];
};

/**
 * Every status seeded to 0, derived from the schema enum so new statuses show
 * up automatically instead of being silently missing from responses.
 */
function emptyCounts(): StatusCounts {
  return Object.fromEntries(
    Object.values(ReadStatus).map((status) => [status, 0]),
  ) as StatusCounts;
}

/**
 * Counts only, without loading any book rows. Use when the caller needs totals
 * but not the books themselves.
 *
 * Returns null if the username doesn't exist, which callers should distinguish
 * from a user whose shelf is simply empty.
 */
export async function getUserShelfSummary(
  username: string,
): Promise<ShelfSummary | null> {
  const [user, grouped] = await Promise.all([
    prisma.user.findUnique({
      where: { username },
      select: { username: true },
    }),
    prisma.userRead.groupBy({
      by: ["status"],
      where: { user: { username } },
      orderBy: { status: "asc" },
      _count: true,
    }),
  ]);

  if (!user) return null;

  const countsByStatus = emptyCounts();
  let totalBooks = 0;
  for (const row of grouped) {
    countsByStatus[row.status] = row._count;
    totalBooks += row._count;
  }

  return { username: user.username, totalBooks, countsByStatus };
}

/**
 * Books plus counts. Derives the counts from the rows it already loaded rather
 * than issuing a second aggregate query.
 *
 * Returns null if the username doesn't exist.
 */
export async function getUserShelf(username: string): Promise<Shelf | null> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      reads: {
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          book: { select: { id: true, title: true, author: true } },
        },
      },
    },
  });

  if (!user) return null;

  const countsByStatus = emptyCounts();
  for (const read of user.reads) {
    countsByStatus[read.status] += 1;
  }

  const books = user.reads.map((read) => ({
    id: read.book.id,
    title: read.book.title,
    author: read.book.author,
    status: read.status,
  }));

  return {
    username: user.username,
    totalBooks: books.length,
    countsByStatus,
    books,
  };
}
