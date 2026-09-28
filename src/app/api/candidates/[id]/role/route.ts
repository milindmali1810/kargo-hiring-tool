import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { candidates } from "@/lib/db/schema";

/**
 * PATCH /api/candidates/[id]/role — manually assign PM/SPM to a candidate the
 * tagger left as "unclear". Scoring requires a concrete role (criterion f
 * needs a target JD), so this is the recovery path for the handful of CVs
 * that don't clearly fit either posting.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body.role !== "PM" && body.role !== "SPM") {
    return NextResponse.json({ error: "role must be 'PM' or 'SPM'" }, { status: 400 });
  }

  const [updated] = await db
    .update(candidates)
    .set({ roleTarget: body.role, taggingRationale: "Manually assigned by reviewer" })
    .where(eq(candidates.id, id))
    .returning({ id: candidates.id, roleTarget: candidates.roleTarget });

  if (!updated) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  return NextResponse.json(updated);
}
