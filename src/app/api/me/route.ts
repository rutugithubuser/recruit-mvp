// Returns the logged-in user's profile and their candidate / company / firm record.
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmDueEvents } from "@/lib/agents/scores";
import { linkCode, whatsappConfigured } from "@/lib/whatsapp";

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return Response.json({ error: "Not logged in" }, { status: 401 });

  await confirmDueEvents();
  const { role } = ctx.profile;
  const table = role === "candidate" ? "candidates" : role === "employer" ? "companies" : "recruitment_firms";
  const column = role === "candidate" ? "user_id" : "owner_id";

  const { data: entity } = await supabaseAdmin.from(table).select("*").eq(column, ctx.userId).maybeSingle();

  const whatsapp = whatsappConfigured()
    ? {
        linked: Boolean(ctx.profile.phone),
        phone: ctx.profile.phone ? ctx.profile.phone.slice(0, -4).replace(/\d/g, "•") + ctx.profile.phone.slice(-4) : null,
        code: linkCode(ctx.userId),
        number: (process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886").replace("whatsapp:", ""),
        join: process.env.TWILIO_SANDBOX_JOIN || null,
      }
    : null;

  return Response.json({ profile: ctx.profile, email: ctx.email, entity, whatsapp });
}
