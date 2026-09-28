import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { candidates, scores, appConfig } from "@/lib/db/schema";
import { scoreCandidate } from "./score";

async function getConfig(key: string): Promise<string> {
  const [row] = await db.select({ value: appConfig.value }).from(appConfig).where(eq(appConfig.key, key));
  if (!row) throw new Error(`Missing app_config value for "${key}"`);
  return row.value;
}

/** Scores one candidate row and writes the result to `scores`. */
export async function runScoreForCandidate(candidateId: string) {
  const [candidate] = await db
    .select({ id: candidates.id, cleanText: candidates.cleanText, roleTarget: candidates.roleTarget })
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.roleTarget === "unclear") {
    throw new Error("Cannot score a candidate tagged 'unclear' — assign a role first.");
  }

  const [rubricText, pmJD, spmJD] = await Promise.all([
    getConfig("rubric"),
    getConfig("jd_pm"),
    getConfig("jd_spm"),
  ]);

  const jdText = candidate.roleTarget === "PM" ? pmJD : spmJD;

  const result = await scoreCandidate({
    cleanText: candidate.cleanText,
    jdText,
    roleLabel: candidate.roleTarget,
    rubricText,
  });

  const evidence = { a: result.a.evidence, b: result.b.evidence, c: result.c.evidence, d: result.d.evidence, e: result.e.evidence, f: result.f.evidence };
  const confidenceFlags = {
    a: result.a.thin_evidence,
    b: result.b.thin_evidence,
    c: result.c.thin_evidence,
    d: result.d.thin_evidence,
    e: result.e.thin_evidence,
    f: result.f.thin_evidence,
  };

  await db
    .insert(scores)
    .values({
      candidateId,
      criterionA: result.a.score,
      criterionB: result.b.score,
      criterionC: result.c.score,
      criterionD: result.d.score,
      criterionE: result.e.score,
      criterionF: result.f.score,
      total: result.total,
      gateTriggered: result.gate_triggered,
      band: result.band,
      rationale: result.rationale,
      evidence,
      confidenceFlags,
      probeQuestions: result.probe_questions,
      modelVersion: result.model_version,
    })
    .onConflictDoUpdate({
      target: scores.candidateId,
      set: {
        criterionA: result.a.score,
        criterionB: result.b.score,
        criterionC: result.c.score,
        criterionD: result.d.score,
        criterionE: result.e.score,
        criterionF: result.f.score,
        total: result.total,
        gateTriggered: result.gate_triggered,
        band: result.band,
        rationale: result.rationale,
        evidence,
        confidenceFlags,
        probeQuestions: result.probe_questions,
        modelVersion: result.model_version,
        scoredAt: new Date(),
      },
    });

  await db.update(candidates).set({ status: "scored" }).where(eq(candidates.id, candidateId));

  return result;
}
