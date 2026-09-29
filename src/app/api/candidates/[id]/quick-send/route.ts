import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { candidates, scores, emailDrafts } from "@/lib/db/schema";
import { draftEmail } from "@/lib/pipeline/draftEmail";
import { scoreRowToResult } from "@/lib/pipeline/score";
import { sendEmailDraft } from "@/lib/pipeline/sendEmail";

/**
 * POST /api/candidates/[id]/quick-send — the dashboard's one-click Invite /
 * Reject action. Generates a fresh personalized draft and sends it in the
 * same request, for exactly one candidate, only when the caller explicitly
 * confirms. This is still "a human acting on that specific candidate" per
 * the hard no-batch-send constraint — it just skips the separate
 * review-the-draft-text step the candidate detail page offers, by design,
 * per the user's request to remove that friction from the main workflow.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const kind: "invite" | "decline" = body.kind === "invite" ? "invite" : "decline";

  if (body?.confirm !== true) {
    return NextResponse.json({ error: "Sending requires an explicit { confirm: true } body" }, { status: 400 });
  }

  const [candidate] = await db
    .select({ name: candidates.name, email: candidates.email, cleanText: candidates.cleanText })
    .from(candidates)
    .where(eq(candidates.id, id));
  const [scoreRow] = await db.select().from(scores).where(eq(scores.candidateId, id));
  if (!candidate || !scoreRow) {
    return NextResponse.json({ error: "Candidate must be scored before sending" }, { status: 400 });
  }
  if (!candidate.email) {
    return NextResponse.json({ error: "Candidate has no email on file" }, { status: 400 });
  }

  // Cheap guard against double-firing on a slow network / double click — any
  // prior draft of this kind that already sent blocks sending another.
  const priorDrafts = await db.select({ kind: emailDrafts.kind, status: emailDrafts.status }).from(emailDrafts).where(eq(emailDrafts.candidateId, id));
  if (priorDrafts.some((d) => d.kind === kind && d.status === "sent")) {
    return NextResponse.json({ error: `A ${kind} email was already sent to this candidate` }, { status: 409 });
  }

  try {
    const scoreResult = scoreRowToResult(scoreRow);
    const draft = await draftEmail({ kind, candidateName: candidate.name, cleanText: candidate.cleanText, score: scoreResult });

    const [inserted] = await db
      .insert(emailDrafts)
      .values({ candidateId: id, kind, subject: draft.subject, body: draft.body, status: "draft" })
      .returning();

    const result = await sendEmailDraft(inserted, candidate.email);
    return NextResponse.json({ sent: true, resend_message_id: result.resendMessageId, kind });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
