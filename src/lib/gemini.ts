import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const MODEL_NAME = "gemini-2.5-pro";

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(apiKey);
}

export { SchemaType };
export const GEMINI_MODEL_VERSION = MODEL_NAME;

/**
 * Calls Gemini with a strict JSON response schema and returns the parsed object.
 * Used for every AI step in the pipeline (normalize, tagRole, score, draftEmail)
 * so scoring arithmetic and structure never drift between calls.
 */
export async function generateJson<T>(params: {
  systemInstruction: string;
  prompt: string;
  schema: object;
}): Promise<T> {
  const model = client().getGenerativeModel({
    model: MODEL_NAME,
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
