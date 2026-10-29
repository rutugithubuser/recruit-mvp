// Every agent action is written to agent_logs (proof that AI does the busy work).
// Aadhaar numbers are masked before anything is logged.
import { supabaseAdmin } from "../supabase/admin";
import { maskAadhaarInText } from "../aadhaar";

function mask(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(maskAadhaarInText(JSON.stringify(value)));
}

export async function logAgent(agent: string, userId: string | null, input: unknown, output: unknown) {
  const { error } = await supabaseAdmin
    .from("agent_logs")
    .insert({ agent, user_id: userId, input: mask(input), output: mask(output) });
  if (error) console.error("agent_logs insert failed:", error.message);
}
