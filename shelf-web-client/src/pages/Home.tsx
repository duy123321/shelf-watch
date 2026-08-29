import type { User } from "@shelf-watch/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ApiError, createUser, getUsers } from "../services/api";

export default function Home() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load users"),
      );
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createUser(username.trim());
      setUsers((prev) => (prev ? [...prev, created] : [created]));
      setUsername("");
    } catch (err) {
      // 409 and 400 both carry a useful message from the API.
      setFormError(
        err instanceof ApiError ? err.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>shelf-watch</h1>
      <p className="muted">Every user with a shelf.</p>

      <form onSubmit={handleSubmit}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="New username"
          aria-label="New username"
        />
        <button type="submit" disabled={submitting || !username.trim()}>
          {submitting ? "Adding..." : "Add user"}
        </button>
      </form>
      {formError && <p className="error">{formError}</p>}

      {error && <p className="error">{error}</p>}
      {!users && !error && <p className="muted">Loading...</p>}

      {users && users.length === 0 && <p className="muted">No users yet.</p>}

      {users && users.length > 0 && (
        <ul className="books">
          {users.map((user) => (
            <li key={user.id}>
              <Link to={`/shelf/${encodeURIComponent(user.username)}`}>
                {user.username}
              </Link>
              <span className="muted">
                joined {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
