import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftEmail } from "@/lib/pipeline/draftEmail";
import type { ScoreResult } from "@/lib/pipeline/score";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const kind: "invite" | "decline" = body.kind === "invite" ? "invite" : "decline";

  const [{ data: candidate, error: candErr }, { data: scoreRow, error: scoreErr }] = await Promise.all([
    supabase.from("candidates").select("name, clean_text").eq("id", id).single(),
    supabase.from("scores").select("*").eq("candidate_id", id).single(),
  ]);
  if (candErr || scoreErr) {
    return NextResponse.json({ error: "Candidate must be scored before drafting an email" }, { status: 400 });
  }

  const scoreResult: ScoreResult = {
    a: { score: scoreRow.criterion_a, evidence: scoreRow.evidence.a, thin_evidence: scoreRow.confidence_flags.a },
    b: { score: scoreRow.criterion_b, evidence: scoreRow.evidence.b, thin_evidence: scoreRow.confidence_flags.b },
    c: { score: scoreRow.criterion_c, evidence: scoreRow.evidence.c, thin_evidence: scoreRow.confidence_flags.c },
    d: { score: scoreRow.criterion_d, evidence: scoreRow.evidence.d, thin_evidence: scoreRow.confidence_flags.d },
    e: { score: scoreRow.criterion_e, evidence: scoreRow.evidence.e, thin_evidence: scoreRow.confidence_flags.e },
    f: { score: scoreRow.criterion_f, evidence: scoreRow.evidence.f, thin_evidence: scoreRow.confidence_flags.f },
    rationale: scoreRow.rationale,
    probe_questions: scoreRow.probe_questions,
    total: scoreRow.total,
    gate_triggered: scoreRow.gate_triggered,
    band: scoreRow.band,
    model_version: scoreRow.model_version,
  };

  try {
    const draft = await draftEmail({ kind, candidateName: candidate.name, cleanText: candidate.clean_text, score: scoreResult });

    const { data: inserted, error: insertErr } = await supabase
      .from("email_drafts")
      .insert({ candidate_id: id, kind, subject: draft.subject, body: draft.body, status: "draft" })
      .select("*")
      .single();
    if (insertErr) throw insertErr;

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
