import { generateJson, GEMINI_MODEL_VERSION, SCORING_MODEL, SchemaType } from "@/lib/gemini";

export interface CriterionScore {
  score: number;
  evidence: string; // verbatim quote from the CV, or "" if score is 0
  thin_evidence: boolean; // true if this score was inferred rather than directly evidenced
}

export interface ScoreResult {
  a: CriterionScore;
  b: CriterionScore;
  c: CriterionScore;
  d: CriterionScore;
  e: CriterionScore;
  f: CriterionScore;
  rationale: string;
  probe_questions: string[];
  total: number;
  gate_triggered: boolean;
  band: "advance" | "hold" | "decline";
  model_version: string;
}

const criterionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.NUMBER },
    evidence: { type: SchemaType.STRING },
    thin_evidence: { type: SchemaType.BOOLEAN },
  },
  required: ["score", "evidence", "thin_evidence"],
};

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    a: criterionSchema,
    b: criterionSchema,
    c: criterionSchema,
    d: criterionSchema,
    e: criterionSchema,
    f: criterionSchema,
    rationale: { type: SchemaType.STRING },
    probe_questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["a", "b", "c", "d", "e", "f", "rationale", "probe_questions"],
};

const MAX_POINTS = { a: 25, b: 20, c: 20, d: 15, e: 10, f: 10 } as const;

function buildSystemInstruction(rubricText: string): string {
  return `You score a candidate's CV against the following rubric. Apply it exactly as written —
do not invent additional criteria, do not adjust the point weights, do not second-guess the point
caps below. Score each criterion 0 to its max: (a) 0-25, (b) 0-20, (c) 0-20, (d) 0-15, (e) 0-10,
(f) 0-10.

For every criterion scored above 0, "evidence" MUST be a verbatim quote copied from the CV text —
never paraphrase, never invent a quote. If you cannot find a verbatim quote, score that criterion 0
and leave evidence as an empty string. Set "thin_evidence": true whenever a nonzero score was
inferred from indirect signal rather than a clear, direct match in the text (e.g. inferring
zero-to-one ownership from job title/seniority alone, without an explicit "built from scratch"
style statement).

"rationale" is a plain-language explanation of the overall ranking placement, written for a
non-technical hiring manager. "probe_questions" are 2-3 targeted interview questions aimed at the
single largest unscored gap or unverified claim in this CV — not generic questions.

RUBRIC:
${rubricText}`;
}

export async function scoreCandidate(params: {
  cleanText: string;
  jdText: string; // the JD for whichever role this candidate is tagged against — used for criterion (f) only
  roleLabel: "PM" | "SPM";
  rubricText: string;
}): Promise<ScoreResult> {
  const raw = await generateJson<Omit<ScoreResult, "total" | "gate_triggered" | "band" | "model_version">>({
    systemInstruction: buildSystemInstruction(params.rubricText),
    prompt: `TARGET ROLE: ${params.roleLabel}\n\nJOB DESCRIPTION (use this ONLY for criterion (f) role-scope fit; criteria (a)-(e) are evaluated identically regardless of role):\n${params.jdText}\n\n---\n\nCANDIDATE CV:\n${params.cleanText}`,
    schema,
    model: SCORING_MODEL,
  });

  // Clamp each criterion to its documented max — the model is instructed not to
  // exceed these, but arithmetic correctness must never depend on it complying.
  const clamped = {
    a: { ...raw.a, score: clamp(raw.a.score, MAX_POINTS.a) },
    b: { ...raw.b, score: clamp(raw.b.score, MAX_POINTS.b) },
    c: { ...raw.c, score: clamp(raw.c.score, MAX_POINTS.c) },
    d: { ...raw.d, score: clamp(raw.d.score, MAX_POINTS.d) },
    e: { ...raw.e, score: clamp(raw.e.score, MAX_POINTS.e) },
    f: { ...raw.f, score: clamp(raw.f.score, MAX_POINTS.f) },
  };

  const total = clamped.a.score + clamped.b.score + clamped.c.score + clamped.d.score + clamped.e.score + clamped.f.score;
  const gateTriggered = clamped.a.score + clamped.b.score < 15;

  let band: ScoreResult["band"];
  if (gateTriggered) {
    band = "hold";
  } else if (total >= 70) {
    band = "advance";
  } else if (total >= 40) {
    band = "hold";
  } else {
    band = "decline";
  }

  return {
    ...clamped,
    rationale: raw.rationale,
    probe_questions: raw.probe_questions,
    total,
    gate_triggered: gateTriggered,
    band,
    model_version: GEMINI_MODEL_VERSION,
  };
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** Rehydrates a `scores` table row (Drizzle select shape) back into a ScoreResult. */
export function scoreRowToResult(row: {
  criterionA: number;
  criterionB: number;
  criterionC: number;
  criterionD: number;
  criterionE: number;
  criterionF: number;
  evidence: unknown;
  confidenceFlags: unknown;
  rationale: string;
  probeQuestions: unknown;
  total: number;
  gateTriggered: boolean;
  band: "advance" | "hold" | "decline";
  modelVersion: string;
}): ScoreResult {
  const evidence = row.evidence as Record<string, string>;
  const confidenceFlags = row.confidenceFlags as Record<string, boolean>;
  return {
    a: { score: row.criterionA, evidence: evidence.a, thin_evidence: confidenceFlags.a },
    b: { score: row.criterionB, evidence: evidence.b, thin_evidence: confidenceFlags.b },
    c: { score: row.criterionC, evidence: evidence.c, thin_evidence: confidenceFlags.c },
    d: { score: row.criterionD, evidence: evidence.d, thin_evidence: confidenceFlags.d },
    e: { score: row.criterionE, evidence: evidence.e, thin_evidence: confidenceFlags.e },
    f: { score: row.criterionF, evidence: evidence.f, thin_evidence: confidenceFlags.f },
    rationale: row.rationale,
    probe_questions: row.probeQuestions as string[],
    total: row.total,
    gate_triggered: row.gateTriggered,
    band: row.band,
    model_version: row.modelVersion,
  };
}
