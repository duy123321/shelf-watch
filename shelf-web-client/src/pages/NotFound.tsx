import { Link } from "react-router";

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p className="muted">
        <Link to="/">Back to all users</Link>
      </p>
    </main>
  );
}
