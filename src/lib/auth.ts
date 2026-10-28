// Server helper: reads the Bearer token from a request and returns the user + profile.
import { supabaseAdmin } from "./supabase/admin";

export type Role = "candidate" | "employer" | "recruiter";

export type Profile = {
  id: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
};

export type AuthContext = { userId: string; email: string | null; profile: Profile };

export async function getAuthContext(req: Request): Promise<AuthContext | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, full_name, phone")
    .eq("id", data.user.id)
    .single();
  if (!profile) return null;

  return { userId: data.user.id, email: data.user.email ?? null, profile: profile as Profile };
}
