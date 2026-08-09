import { NextResponse } from "next/server";
import { getUserShelfSummary } from "@/lib/services/users";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const summary = await getUserShelfSummary(username);

  if (!summary) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(summary);
}
