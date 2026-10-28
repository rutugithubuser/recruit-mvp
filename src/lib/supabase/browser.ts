// Browser Supabase client. Used ONLY for login/session. All data access goes
// through our server API routes (tables are protected by RLS).
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
