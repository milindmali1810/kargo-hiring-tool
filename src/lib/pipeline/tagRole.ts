import { generateJson, SchemaType } from "@/lib/gemini";

export interface RoleTagResult {
  role_target: "PM" | "SPM" | "unclear";
  reason: string;
}

const schema = {
  type: SchemaType.OBJECT,
  properties: {
    role_target: { type: SchemaType.STRING, enum: ["PM", "SPM", "unclear"] },
    reason: { type: SchemaType.STRING },
  },
  required: ["role_target", "reason"],
};

const SYSTEM_INSTRUCTION = `You classify which of two open job postings a candidate's resume is the better fit
for, based purely on their experience level and the scope described in each JD. This is a triage tag for
which JD to use later as the "role-scope fit" criterion in a separate scoring pass — it is not itself a
hiring judgment, so be decisive rather than hedging into "unclear" whenever there's a reasonable read.
Use "unclear" only when the resume shows no realistic fit with either posting at all (e.g. an unrelated
function like pure sales, marketing, or finance with no product/ownership signal whatsoever).`;

export async function tagRole(
  cleanText: string,
  pmJD: string,
  spmJD: string
): Promise<RoleTagResult> {
  return generateJson<RoleTagResult>({
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt: `PRODUCT MANAGER JD:\n${pmJD}\n\n---\n\nSENIOR PRODUCT MANAGER JD:\n${spmJD}\n\n---\n\nCANDIDATE RESUME:\n${cleanText}`,
    schema,
  });
}
