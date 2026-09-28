import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Scoring is the one step where reasoning quality matters most (it implements
// Rubric.txt directly), so it gets the pro model. Extraction/classification/
// drafting are simpler structured tasks and run much faster on flash — with
// ~70 candidates to process, the pro model's latency on every step would make
// a full run impractically slow.
export const SCORING_MODEL = "gemini-3.1-pro-preview";
export const FAST_MODEL = "gemini-3.1-flash-lite-preview";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

export { SchemaType };
export const GEMINI_MODEL_VERSION = SCORING_MODEL;

/**
 * Calls Gemini with a strict JSON response schema and returns the parsed object.
 * Used for every AI step in the pipeline (normalize, tagRole, score, draftEmail)
 * so scoring arithmetic and structure never drift between calls.
 */
export async function generateJson<T>(params: {
  systemInstruction: string;
  prompt: string;
  schema: object;
  model?: string;
}): Promise<T> {
  const model = client().getGenerativeModel({
    model: params.model ?? FAST_MODEL,
    systemInstruction: params.systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: params.schema as never,
    },
  });

  const result = await model.generateContent(params.prompt);
  const text = result.response.text();
  return JSON.parse(text) as T;
}
