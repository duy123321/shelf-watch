import { NextResponse } from "next/server";
import { getUserShelf } from "@/lib/services/users";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const shelf = await getUserShelf(username);

  if (!shelf) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(shelf.books);
}
