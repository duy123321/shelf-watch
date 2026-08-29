import { Link } from "react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// No auth yet — the header avatar points at a fixed user so the route is
// walkable. Swap this for the signed-in user once sessions exist.
const CURRENT_USER_ID = 1;

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-end px-6 py-4">
        <Link
          to={`/user/${CURRENT_USER_ID}`}
          aria-label="Your profile"
          className="rounded-full ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Avatar className="size-9">
            <AvatarImage src="" alt="" />
            <AvatarFallback>ME</AvatarFallback>
          </Avatar>
        </Link>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16" />
    </div>
  );
}
