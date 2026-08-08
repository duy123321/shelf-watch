import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany();
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const { username } = await request.json();
  const user = await prisma.user.create({ data: { username } });
  return NextResponse.json(user, { status: 201 });
}
