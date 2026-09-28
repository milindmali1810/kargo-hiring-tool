import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/candidates/[id]/send-email — the ONLY call site of Resend's send
 * API in this codebase. Sends exactly one draft, for one candidate, and only
 * when the request body explicitly confirms the action. There is deliberately
 * no batch or list variant of this route — see Rubric.txt / the original brief's
 * hard constraint: nothing sends until a human acts on that specific candidate.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  if (body?.confirm !== true || typeof body?.draftId !== "string") {
    return NextResponse.json(
      { error: "Sending requires an explicit { draftId, confirm: true } body" },
      { status: 400 }
    );
  }

  const [{ data: draft, error: draftErr }, { data: candidate, error: candErr }] = await Promise.all([
    supabase.from("email_drafts").select("*").eq("id", body.draftId).eq("candidate_id", id).single(),
    supabase.from("candidates").select("email, name").eq("id", id).single(),
  ]);
  if (draftErr || candErr) {
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

  const { error: updateErr } = await supabase
    .from("email_drafts")
    .update({ status: "sent", sent_at: new Date().toISOString(), resend_message_id: sent?.id ?? null })
    .eq("id", draft.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ sent: true, resend_message_id: sent?.id ?? null });
}
