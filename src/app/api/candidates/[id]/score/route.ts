import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runScoreForCandidate } from "@/lib/pipeline/runScore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const result = await runScoreForCandidate(id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
