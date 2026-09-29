import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { candidates, emailDrafts } from "@/lib/db/schema";
import { sendEmailDraft } from "@/lib/pipeline/sendEmail";

/**
 * POST /api/candidates/[id]/send-email — sends an existing, already-reviewed
 * draft. Sends exactly one draft, for one candidate, and only when the
 * request body explicitly confirms the action. There is deliberately no
 * batch or list variant of this route — see Rubric.txt / the original
 * brief's hard constraint: nothing sends until a human acts on that
 * specific candidate.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body?.confirm !== true || typeof body?.draftId !== "string") {
    return NextResponse.json(
      { error: "Sending requires an explicit { draftId, confirm: true } body" },
      { status: 400 }
    );
  }

  const [draft] = await db.select().from(emailDrafts).where(and(eq(emailDrafts.id, body.draftId), eq(emailDrafts.candidateId, id)));
  const [candidate] = await db.select({ email: candidates.email, name: candidates.name }).from(candidates).where(eq(candidates.id, id));
  if (!draft || !candidate) {
    return NextResponse.json({ error: "Draft or candidate not found" }, { status: 404 });
  }
  if (draft.status === "sent") {
    return NextResponse.json({ error: "This draft has already been sent" }, { status: 409 });
  }
  if (!candidate.email) {
    return NextResponse.json({ error: "Candidate has no email on file" }, { status: 400 });
  }

  try {
    const result = await sendEmailDraft(draft, candidate.email);
    return NextResponse.json({ sent: true, resend_message_id: result.resendMessageId });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
