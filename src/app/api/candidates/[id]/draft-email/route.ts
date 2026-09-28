import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { candidates, scores, emailDrafts } from "@/lib/db/schema";
import { draftEmail } from "@/lib/pipeline/draftEmail";
import type { ScoreResult } from "@/lib/pipeline/score";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const kind: "invite" | "decline" = body.kind === "invite" ? "invite" : "decline";

  const [candidate] = await db.select({ name: candidates.name, cleanText: candidates.cleanText }).from(candidates).where(eq(candidates.id, id));
  const [scoreRow] = await db.select().from(scores).where(eq(scores.candidateId, id));
  if (!candidate || !scoreRow) {
    return NextResponse.json({ error: "Candidate must be scored before drafting an email" }, { status: 400 });
  }

  const evidence = scoreRow.evidence as Record<string, string>;
  const confidenceFlags = scoreRow.confidenceFlags as Record<string, boolean>;
  const scoreResult: ScoreResult = {
    a: { score: scoreRow.criterionA, evidence: evidence.a, thin_evidence: confidenceFlags.a },
    b: { score: scoreRow.criterionB, evidence: evidence.b, thin_evidence: confidenceFlags.b },
    c: { score: scoreRow.criterionC, evidence: evidence.c, thin_evidence: confidenceFlags.c },
    d: { score: scoreRow.criterionD, evidence: evidence.d, thin_evidence: confidenceFlags.d },
    e: { score: scoreRow.criterionE, evidence: evidence.e, thin_evidence: confidenceFlags.e },
    f: { score: scoreRow.criterionF, evidence: evidence.f, thin_evidence: confidenceFlags.f },
    rationale: scoreRow.rationale,
    probe_questions: scoreRow.probeQuestions as string[],
    total: scoreRow.total,
    gate_triggered: scoreRow.gateTriggered,
    band: scoreRow.band,
    model_version: scoreRow.modelVersion,
  };

  try {
    const draft = await draftEmail({ kind, candidateName: candidate.name, cleanText: candidate.cleanText, score: scoreResult });

    const [inserted] = await db
      .insert(emailDrafts)
      .values({ candidateId: id, kind, subject: draft.subject, body: draft.body, status: "draft" })
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
