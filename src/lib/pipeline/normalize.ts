import { generateJson, SchemaType } from "@/lib/gemini";

export interface NormalizedCandidate {
  name: string | null;
  email: string | null;
  phone: string | null;
  roles_held: { title: string; company: string; dates: string }[];
  years_experience: number | null;
  achievement_bullets: string[];
  clean_text: string;
}

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    name: { type: SchemaType.STRING, nullable: true },
    email: { type: SchemaType.STRING, nullable: true },
    phone: { type: SchemaType.STRING, nullable: true },
    roles_held: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          company: { type: SchemaType.STRING },
          dates: { type: SchemaType.STRING },
        },
        required: ["title", "company", "dates"],
      },
    },
    years_experience: { type: SchemaType.NUMBER, nullable: true },
    achievement_bullets: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    clean_text: { type: SchemaType.STRING },
  },
  required: ["roles_held", "achievement_bullets", "clean_text"],
};

const SYSTEM_INSTRUCTION = `You extract structured fields from a raw resume text dump and produce a
PII-stripped version of the CV for downstream AI scoring.

Rules for clean_text:
- Reproduce the resume's substantive content (roles, achievements, education, skills) losslessly.
- Remove any line that is ONLY a personal-identifier field: photo captions/alt-text artifacts, marital
  status, age, date of birth, gender, nationality, religion, or a physical address beyond city/state.
  Name, email, phone, and city are fine to keep since they are needed for outreach.
- Do not summarize or paraphrase achievement bullets — keep them verbatim so evidence quotes stay accurate.
- Fix obvious PDF-extraction artifacts (stray bullet glyphs, broken line breaks) without changing wording.`;

export async function normalize(rawText: string): Promise<NormalizedCandidate> {
  return generateJson<NormalizedCandidate>({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `Raw resume text:\n\n${rawText}`,
    schema,
  });
}
