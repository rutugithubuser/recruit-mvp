// Returns the logged-in user's profile and their candidate / company / firm record.
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmDueEvents } from "@/lib/agents/scores";

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return Response.json({ error: "Not logged in" }, { status: 401 });

  await confirmDueEvents();
  const { role } = ctx.profile;
  const table = role === "candidate" ? "candidates" : role === "employer" ? "companies" : "recruitment_firms";
  const column = role === "candidate" ? "user_id" : "owner_id";

  const { data: entity } = await supabaseAdmin.from(table).select("*").eq(column, ctx.userId).maybeSingle();

  return Response.json({ profile: ctx.profile, email: ctx.email, entity });
}
