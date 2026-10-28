// Creates a user (email auto-confirmed for the MVP), their profile, and their role record.
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLES = ["candidate", "employer", "recruiter"] as const;

export async function POST(req: Request) {
  const { email, password, full_name, role } = await req.json().catch(() => ({}));

  if (!email || !password || !full_name || !ROLES.includes(role)) {
    return Response.json({ error: "Name, email, password and role are required." }, { status: 400 });
  }
  if (String(password).length < 6) {
    return Response.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error || !data.user) {
    return Response.json({ error: error?.message ?? "Could not create account." }, { status: 400 });
  }

  const userId = data.user.id;
  const { error: pErr } = await supabaseAdmin.from("profiles").insert({ id: userId, role, full_name });
  if (pErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return Response.json({ error: pErr.message }, { status: 500 });
  }

  if (role === "candidate") {
    await supabaseAdmin.from("candidates").insert({ user_id: userId, full_name, email });
  }
  // Employers and recruiters get their company/firm record from the profile agent (by voice/text).

  return Response.json({ ok: true });
}
