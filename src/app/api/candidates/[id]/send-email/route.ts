import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { Resend } from "resend";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { candidates, emailDrafts } from "@/lib/db/schema";

/**
 * POST /api/candidates/[id]/send-email — the ONLY call site of Resend's send
 * API in this codebase. Sends exactly one draft, for one candidate, and only
 * when the request body explicitly confirms the action. There is deliberately
 * no batch or list variant of this route — see Rubric.txt / the original brief's
 * hard constraint: nothing sends until a human acts on that specific candidate.
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

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data: sent, error: sendErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: candidate.email,
    subject: draft.subject,
    text: draft.body,
  });
  if (sendErr) {
    return NextResponse.json({ error: sendErr.message }, { status: 502 });
  }

  await db
    .update(emailDrafts)
    .set({ status: "sent", sentAt: new Date(), resendMessageId: sent?.id ?? null })
    .where(eq(emailDrafts.id, draft.id));

  return NextResponse.json({ sent: true, resend_message_id: sent?.id ?? null });
}
