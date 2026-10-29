// Thin wrapper around Gemini. Every agent calls the model through here.
// Speed: "fast" calls (routing, picking) use the lite model with minimal thinking.
// Writing calls (JDs, letters, resumes) use flash. All calls use minimal thinking for speed.
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const FLASH = process.env.GEMINI_MODEL || "gemini-flash-latest";
const LITE = process.env.GEMINI_FAST_MODEL || "gemini-flash-lite-latest";

type Contents = Parameters<typeof ai.models.generateContent>[0]["contents"];
type Config = NonNullable<Parameters<typeof ai.models.generateContent>[0]["config"]>;
export type CallOptions = { fast?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Thinking levels to try, lightest first. Some models reject MINIMAL; we fall back to LOW,
// never to "no setting" (that makes the model use its slow default of heavy thinking).
const LEVELS = [ThinkingLevel.MINIMAL, ThinkingLevel.LOW, ThinkingLevel.MEDIUM];
// Remembers the lightest level each model accepts, so the failed attempt is not repeated.
const levelFor = new Map<string, number>();
// Models whose DAILY free quota is used up: skipped until the server restarts.
const dailyBlocked = new Set<string>();

async function call(contents: Contents, config: Config, opts: CallOptions = {}): Promise<string> {
  // Lite is fast, accurate enough for every agent, and has the larger free quota, so it goes first.
  // Set GEMINI_PREFER_FLASH=true in .env.local to use flash first for writing tasks.
  const preferFlash = process.env.GEMINI_PREFER_FLASH === "true" && !opts.fast;
  const models = (preferFlash ? [FLASH, LITE] : [LITE, FLASH]).filter((m) => !dailyBlocked.has(m));
  let firstError: unknown;
  let quotaHit = false;

  for (const model of models) {
    let level = levelFor.get(model) ?? 0;
    let retriedBusy = false;
    while (level < LEVELS.length) {
      const started = Date.now();
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: { ...config, thinkingConfig: { thinkingLevel: LEVELS[level] } },
        });
        levelFor.set(model, level);
        console.log(`[gemini] ${model} (${LEVELS[level]}) ${((Date.now() - started) / 1000).toFixed(1)}s`);
        return res.text ?? "";
      } catch (e) {
        firstError ??= e;
        const msg = String((e as Error)?.message ?? e);
        console.warn(`[gemini] ${model} (${LEVELS[level]}) failed after ${((Date.now() - started) / 1000).toFixed(1)}s: ${msg.slice(0, 120)}`);
        if (msg.includes("429") || /quota|RESOURCE_EXHAUSTED/i.test(msg)) {
          // Each model has its own free-tier quota: switch to the other model instead of failing.
          const which = msg.match(/quotaId[^A-Za-z]+([A-Za-z-]+)/)?.[1] ?? "unknown";
          console.warn(`[gemini] ${model} quota hit (${which}) -> trying next model`);
          quotaHit = true;
          if (/PerDay/i.test(which)) dailyBlocked.add(model);
          break;
        }
        if (/thinking/i.test(msg)) {
          level++; // this level isn't supported by this model -> try the next lightest
          continue;
        }
        if (/503|500|UNAVAILABLE|overloaded|INTERNAL/i.test(msg) && !retriedBusy) {
          retriedBusy = true;
          await sleep(800);
          continue;
        }
        break; // try the next model
      }
    }
  }
  if (quotaHit) throw new Error("AI free-tier limit reached on all models. Please wait a minute and try again.");
  const msg = String((firstError as Error)?.message ?? firstError);
  throw new Error(/503|UNAVAILABLE|overloaded/i.test(msg)
    ? "The AI model is busy right now. Please try again in a few seconds."
    : "AI error: " + msg.slice(0, 200));
}

/** Ask the model for JSON that matches a JSON Schema. */
export async function generateJSON<T>(contents: Contents, schema: object, system?: string, opts?: CallOptions): Promise<T> {
  const text = await call(contents, {
    systemInstruction: system,
    responseMimeType: "application/json",
    responseJsonSchema: schema,
    temperature: 0.3,
  }, opts);
  return JSON.parse(text) as T;
}

/** Ask the model for plain text (letters, descriptions, etc.). */
export async function generateText(contents: Contents, system?: string, opts?: CallOptions): Promise<string> {
  return call(contents, { systemInstruction: system, temperature: 0.6 }, opts);
}
