// Thin wrapper around Gemini. Every agent calls the model through here.
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// "-latest" aliases always point to Google's current models, so they don't go stale.
// Override with GEMINI_MODEL in .env.local if needed.
const MODELS = [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];

type Contents = Parameters<typeof ai.models.generateContent>[0]["contents"];
type Config = Parameters<typeof ai.models.generateContent>[0]["config"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(contents: Contents, config: Config): Promise<string> {
  let firstError: unknown;
  for (const model of MODELS) {
    // Up to 2 tries per model: free-tier models are sometimes briefly overloaded (503).
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await ai.models.generateContent({ model, contents, config });
        return res.text ?? "";
      } catch (e) {
        firstError ??= e;
        const msg = String((e as Error)?.message ?? e);
        if (msg.includes("429") || /quota|RESOURCE_EXHAUSTED/i.test(msg)) {
          throw new Error("AI rate limit reached (free tier). Please wait a minute and try again.");
        }
        const temporary = /503|500|UNAVAILABLE|overloaded|INTERNAL/i.test(msg);
        if (temporary && attempt === 0) {
          await sleep(1500);
          continue;
        }
        break; // not temporary, or retried already -> try next model
      }
    }
  }
  const msg = String((firstError as Error)?.message ?? firstError);
  throw new Error(/503|UNAVAILABLE|overloaded/i.test(msg)
    ? "The AI model is busy right now. Please try again in a few seconds."
    : "AI error: " + msg.slice(0, 200));
}

/** Ask the model for JSON that matches a JSON Schema. */
export async function generateJSON<T>(
  contents: Contents,
  schema: object,
  system?: string
): Promise<T> {
  const text = await call(contents, {
    systemInstruction: system,
    responseMimeType: "application/json",
    responseJsonSchema: schema,
    temperature: 0.3,
  });
  return JSON.parse(text) as T;
}

/** Ask the model for plain text (letters, descriptions, etc.). */
export async function generateText(contents: Contents, system?: string): Promise<string> {
  return call(contents, { systemInstruction: system, temperature: 0.6 });
}
