import { generateJson, SchemaType } from "@/lib/gemini";
import type { ScoreResult } from "./score";

export interface EmailDraft {
  subject: string;
  body: string;
}

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    subject: { type: SchemaType.STRING },
    body: { type: SchemaType.STRING },
  },
  required: ["subject", "body"],
};

const INVITE_INSTRUCTION = `Draft a short, warm interview-invite email from Arjun Mehta (Founder, Kargo) to a
candidate who is advancing to interview for a Product Manager / Senior Product Manager role. Reference
one specific, genuine strength from their CV evidence (not generic flattery). Ask them to share
availability for a call. Keep it under 120 words. Do not mention a score, band, or the word "rubric".`;

const DECLINE_INSTRUCTION = `Draft a short, respectful decline email from Arjun Mehta (Founder, Kargo) to a
candidate. It should be genuinely personalized — reference their actual background at a high level — but
must not disclose a score, a scoring rubric, or the specific internal reason for the decision. Keep it
warm, brief (under 100 words), and leave the door open for future roles if genuinely appropriate. Do not
be generic corporate boilerplate.`;

export async function draftEmail(params: {
  kind: "invite" | "decline";
  candidateName: string | null;
  cleanText: string;
  score: ScoreResult;
}): Promise<EmailDraft> {
  const instruction = params.kind === "invite" ? INVITE_INSTRUCTION : DECLINE_INSTRUCTION;

  return generateJson<EmailDraft>({
    systemInstruction: instruction,
    prompt: `Candidate name: ${params.candidateName ?? "the candidate"}\n\nCV evidence gathered during screening:\n${JSON.stringify(
      { a: params.score.a.evidence, b: params.score.b.evidence, c: params.score.c.evidence, d: params.score.d.evidence, e: params.score.e.evidence, f: params.score.f.evidence },
      null,
      2
    )}\n\nFull CV text for additional context:\n${params.cleanText}`,
    schema,
  });
}
