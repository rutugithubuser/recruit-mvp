// Helper used by many agents: figure out WHICH record (offer, job, employee...) the user means.
import { generateJSON } from "../gemini";
import type { ChatTurn, Entities } from "./types";
import { historyText } from "./util";

export async function pickOne(opts: {
  what: string;
  records: Record<string, unknown>[];
  message: string;
  history: ChatTurn[];
  entities: Entities;
  needConfirm?: boolean;
}): Promise<{ id: string | null; confirmed: boolean; question?: string }> {
  const { records, needConfirm } = opts;
  if (!records.length) return { id: null, confirmed: false };
  if (records.length === 1 && !needConfirm) return { id: records[0].id as string, confirmed: true };

  const out = await generateJSON<{ id: string; confirmed: boolean; question?: string }>(
    `${historyText(opts.history)}User says: ${opts.message}
Extracted: ${JSON.stringify(opts.entities)}
Options (${opts.what}): ${JSON.stringify(records)}`,
    {
      type: "object",
      properties: {
        id: { type: "string", description: "id of the option the user means, or empty if unclear" },
        confirmed: { type: "boolean", description: "true ONLY if the user's latest message clearly confirms the action (e.g. 'yes', 'I confirm')" },
        question: { type: "string", description: "If unclear, one short question to identify the option" },
      },
      required: ["id", "confirmed"],
    },
    `You pick which ${opts.what} the user is referring to, using names, roles, companies and the conversation. If only one option fits, pick it.`
  );

  const valid = records.some((r) => r.id === out.id);
  return { id: valid ? out.id : null, confirmed: !!out.confirmed, question: out.question };
}

/** Cast a Supabase joined relation to a typed object. */
export function rel<T>(x: unknown): T | null {
  if (Array.isArray(x)) return (x[0] as T) ?? null;
  return (x as T) ?? null;
}
