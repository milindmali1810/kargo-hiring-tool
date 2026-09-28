import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreCandidate } from "./score";

async function getConfig(supabase: SupabaseClient, key: string): Promise<string> {
  const { data, error } = await supabase.from("app_config").select("value").eq("key", key).single();
  if (error) throw new Error(`Missing app_config value for "${key}": ${error.message}`);
  return data.value as string;
}

/** Scores one candidate row and writes the result to `scores`. */
export async function runScoreForCandidate(supabase: SupabaseClient, candidateId: string) {
  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id, clean_text, role_target")
    .eq("id", candidateId)
    .single();
  if (error) throw error;
  if (candidate.role_target === "unclear") {
    throw new Error("Cannot score a candidate tagged 'unclear' — assign a role first.");
  }

  const [rubricText, pmJD, spmJD] = await Promise.all([
    getConfig(supabase, "rubric"),
    getConfig(supabase, "jd_pm"),
    getConfig(supabase, "jd_spm"),
  ]);

  const jdText = candidate.role_target === "PM" ? pmJD : spmJD;

  const result = await scoreCandidate({
    cleanText: candidate.clean_text,
    jdText,
    roleLabel: candidate.role_target,
    rubricText,
  });

  const { error: upsertErr } = await supabase.from("scores").upsert(
    {
      candidate_id: candidateId,
      criterion_a: result.a.score,
      criterion_b: result.b.score,
      criterion_c: result.c.score,
      criterion_d: result.d.score,
      criterion_e: result.e.score,
      criterion_f: result.f.score,
      total: result.total,
      gate_triggered: result.gate_triggered,
      band: result.band,
      rationale: result.rationale,
      evidence: {
        a: result.a.evidence,
        b: result.b.evidence,
        c: result.c.evidence,
        d: result.d.evidence,
        e: result.e.evidence,
        f: result.f.evidence,
      },
      confidence_flags: {
        a: result.a.thin_evidence,
        b: result.b.thin_evidence,
        c: result.c.thin_evidence,
        d: result.d.thin_evidence,
        e: result.e.thin_evidence,
        f: result.f.thin_evidence,
      },
      probe_questions: result.probe_questions,
      model_version: result.model_version,
    },
    { onConflict: "candidate_id" }
  );
  if (upsertErr) throw upsertErr;

  await supabase.from("candidates").update({ status: "scored" }).eq("id", candidateId);

  return result;
}
