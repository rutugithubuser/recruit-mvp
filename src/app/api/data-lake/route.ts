// CENTRAL DATA LAKE viewer. Recruiters see everything; employers and candidates see their own slice.
// Aadhaar is only ever shown as the last 4 digits.
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmDueEvents, EVENT_LABEL } from "@/lib/agents/scores";
import { rel } from "@/lib/agents/resolve";

type Named = { title?: string; name?: string; full_name?: string };
const d = (x?: string | null) => (x ? new Date(x).toLocaleDateString("en-IN") : "");



export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return Response.json({ error: "Not logged in" }, { status: 401 });
  await confirmDueEvents();

  const tab = new URL(req.url).searchParams.get("tab") ?? "resumes";
  const role = ctx.profile.role;

  // Scope: which candidate / company this user is limited to (recruiters: none).
  let candId: string | null = null;
  let coId: string | null = null;
  if (role === "candidate") {
    const { data } = await supabaseAdmin.from("candidates").select("id").eq("user_id", ctx.userId).maybeSingle();
    candId = data?.id ?? "none";
  }
  if (role === "employer") {
    const { data } = await supabaseAdmin.from("companies").select("id").eq("owner_id", ctx.userId).maybeSingle();
    coId = data?.id ?? "none";
  }

  let rows: Record<string, unknown>[] = [];

  if (tab === "resumes") {
    let q = supabaseAdmin.from("resumes").select("source, content, file_path, created_at, candidates(full_name)").order("created_at", { ascending: false }).limit(100);
    if (candId) q = q.eq("candidate_id", candId);
    if (coId) {
      const { data: apps } = await supabaseAdmin.from("applications").select("candidate_id, jobs!inner(company_id)").eq("jobs.company_id", coId);
      q = q.in("candidate_id", [...new Set((apps ?? []).map((a) => a.candidate_id))].concat("00000000-0000-0000-0000-000000000000"));
    }
    const { data } = await q;
    rows = (data ?? []).map((r) => ({
      candidate: rel<Named>(r.candidates)?.full_name, source: r.source, file: r.file_path ? "📎 yes" : "",
      preview: (r.content ?? "").slice(0, 140) + "…", created: d(r.created_at),
    }));
  }

  if (tab === "offers" || tab === "acceptances") {
    if (tab === "offers") {
      let q = supabaseAdmin.from("offers").select("status, salary, joining_date, created_at, jobs(title), candidates(full_name), companies(name)").order("created_at", { ascending: false }).limit(100);
      if (candId) q = q.eq("candidate_id", candId);
      if (coId) q = q.eq("company_id", coId);
      const { data } = await q;
      rows = (data ?? []).map((r) => ({
        candidate: rel<Named>(r.candidates)?.full_name, company: rel<Named>(r.companies)?.name, job: rel<Named>(r.jobs)?.title,
        salary: r.salary, joining: d(r.joining_date), status: r.status, created: d(r.created_at),
      }));
    } else {
      let q = supabaseAdmin.from("acceptances").select("content, created_at, candidate_id, offers!inner(company_id, jobs(title), companies(name)), candidates(full_name)").order("created_at", { ascending: false }).limit(100);
      if (candId) q = q.eq("candidate_id", candId);
      if (coId) q = q.eq("offers.company_id", coId);
      const { data } = await q;
      rows = (data ?? []).map((r) => {
        const o = rel<{ jobs: Named; companies: Named }>(r.offers);
        return {
          candidate: rel<Named>(r.candidates)?.full_name, company: rel<Named>(o?.companies)?.name, job: rel<Named>(o?.jobs)?.title,
          letter: (r.content ?? "").slice(0, 140) + "…", accepted: d(r.created_at),
        };
      });
    }
  }

  if (tab === "hiring") {
    let q = supabaseAdmin.from("employments").select("status, start_date, end_date, candidates(full_name), companies(name), offers(jobs(title))").order("created_at", { ascending: false }).limit(100);
    if (candId) q = q.eq("candidate_id", candId);
    if (coId) q = q.eq("company_id", coId);
    const { data } = await q;
    rows = (data ?? []).map((r) => ({
      candidate: rel<Named>(r.candidates)?.full_name, company: rel<Named>(r.companies)?.name,
      job: rel<Named>(rel<{ jobs: Named }>(r.offers)?.jobs)?.title, status: r.status, started: d(r.start_date), ended: d(r.end_date),
    }));
  }

  if (tab === "scores") {
    let q = supabaseAdmin.from("score_events").select("entity_type, entity_id, event_type, delta, status, created_at, dispute_deadline").order("created_at", { ascending: false }).limit(100);
    if (candId) q = q.eq("entity_id", candId);
    if (coId) q = q.or(`entity_id.eq.${coId},reported_by.eq.${ctx.userId}`);
    const { data } = await q;
    const candIds = (data ?? []).filter((e) => e.entity_type === "candidate").map((e) => e.entity_id);
    const coIds = (data ?? []).filter((e) => e.entity_type === "company").map((e) => e.entity_id);
    const [{ data: cs }, { data: cos }] = await Promise.all([
      supabaseAdmin.from("candidates").select("id, full_name").in("id", candIds.length ? candIds : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("companies").select("id, name").in("id", coIds.length ? coIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const names = new Map([...(cs ?? []).map((c) => [c.id, c.full_name] as const), ...(cos ?? []).map((c) => [c.id, c.name] as const)]);
    rows = (data ?? []).map((e) => ({
      who: names.get(e.entity_id), type: e.entity_type, event: EVENT_LABEL[e.event_type], points: e.status === "confirmed" ? e.delta : 0,
      status: e.status, reported: d(e.created_at), auto_confirms: e.status === "pending" ? new Date(e.dispute_deadline).toLocaleString("en-IN") : "",
    }));
  }

  if (tab === "candidates") {
    if (role === "candidate") return Response.json({ error: "Candidates can only see company scores." }, { status: 403 });
    const { data } = await supabaseAdmin.from("candidates").select("full_name, current_title, location, experience_years, skills, score, aadhaar_last4").order("score").limit(200);
    rows = (data ?? []).map((c) => ({
      name: c.full_name, title: c.current_title, location: c.location, experience: c.experience_years,
      skills: (c.skills ?? []).slice(0, 4).join(", "), aadhaar: c.aadhaar_last4 ? `XXXX ${c.aadhaar_last4}` : "", score: c.score,
    }));
  }

  if (tab === "companies") {
    const { data } = await supabaseAdmin.from("companies").select("name, industry, location, size, score").order("score").limit(200);
    rows = data ?? [];
  }

  if (tab === "activity") {
    let q = supabaseAdmin.from("agent_logs").select("agent, created_at, output, user_id").order("created_at", { ascending: false }).limit(100);
    if (role !== "recruiter") q = q.eq("user_id", ctx.userId);
    const { data } = await q;
    rows = (data ?? []).map((a) => {
      const out = a.output as { intent?: string; reply?: string } | null;
      return { agent: a.agent, result: String(out?.reply ?? out?.intent ?? "").split("\n")[0].slice(0, 120), at: new Date(a.created_at).toLocaleString("en-IN") };
    });
  }

  return Response.json({ tab, role, rows });
}
