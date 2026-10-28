// Every agent action is written to agent_logs (proof that AI does the busy work).
import { supabaseAdmin } from "../supabase/admin";

export async function logAgent(agent: string, userId: string | null, input: unknown, output: unknown) {
  const { error } = await supabaseAdmin
    .from("agent_logs")
    .insert({ agent, user_id: userId, input, output });
  if (error) console.error("agent_logs insert failed:", error.message);
}
