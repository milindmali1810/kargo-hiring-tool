import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials, createSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
  }

  const valid = await verifyCredentials(email, password);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createSessionCookie(email);
  return NextResponse.json({ ok: true });
}
