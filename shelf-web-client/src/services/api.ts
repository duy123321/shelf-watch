import type {
  ReadStatus,
  ShelfBook,
  ShelfSummary,
  UpdateReadStatusBody,
  User,
  UserRead,
} from "@shelf-watch/shared";

// Empty default = same-origin, which the Vite dev proxy handles locally.
// Set VITE_API_URL at build time for production.
const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export const getUsers = () => request<User[]>("/api/users");

export const createUser = (username: string) =>
  request<User>("/api/users", {
    method: "POST",
    body: JSON.stringify({ username }),
  });

// encodeURIComponent matters here — Next.js decoded dynamic segments
// implicitly, and a username with a slash or space would otherwise produce a
// silently wrong URL.
export const getShelfSummary = (username: string) =>
  request<ShelfSummary>(`/api/users/${encodeURIComponent(username)}`);

export const getShelfBooks = (username: string) =>
  request<ShelfBook[]>(`/api/users/${encodeURIComponent(username)}/books`);

/**
 * Moves one book on a shelf to a different read status.
 *
 * Returns the `user_read` row only — no book fields. The caller merges the new
 * `status` into the book it already holds (matched on `bookId`); `title` and
 * `author` come from the immutable `book` row and never change here.
 */
export const updateBookStatus = (
  userId: number,
  bookId: number,
  status: ReadStatus,
) =>
  request<UserRead>("/api/user-reads", {
    method: "PATCH",
    body: JSON.stringify({
      userId,
      bookId,
      status,
    } satisfies UpdateReadStatusBody),
  });
