// Role-specific dashboard data: stats, lists with status, and recent AI agent activity.
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { confirmDueEvents } from "@/lib/agents/scores";
import { rel } from "@/lib/agents/resolve";

type Row = Record<string, unknown>;
type Named = { title?: string; name?: string; full_name?: string; score?: number };

const countOf = (rows: Row[] | null | undefined, key: string, val: string) => (rows ?? []).filter((r) => r[key] === val).length;

export async function GET(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return Response.json({ error: "Not logged in" }, { status: 401 });
  await confirmDueEvents();

  const { data: activity } = await supabaseAdmin
    .from("agent_logs").select("agent, created_at, output").eq("user_id", ctx.userId).neq("agent", "intake")
    .order("created_at", { ascending: false }).limit(8);
  const agentActivity = (activity ?? []).map((a) => ({
    agent: a.agent, at: a.created_at, summary: String((a.output as { reply?: string } | null)?.reply ?? "").split("\n")[0].slice(0, 120),
  }));

  const role = ctx.profile.role;

  if (role === "candidate") {
    const { data: cand } = await supabaseAdmin.from("candidates").select("id, score").eq("user_id", ctx.userId).maybeSingle();
    if (!cand) return Response.json({ role, stats: [], lists: [], agentActivity });
    const [{ data: apps }, { data: offers }, { count: resumes }, { data: versions }] = await Promise.all([
      supabaseAdmin.from("applications").select("status, created_at, jobs(title, companies(name))").eq("candidate_id", cand.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("offers").select("status, salary, joining_date, jobs(title), companies(name, score)").eq("candidate_id", cand.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("resumes").select("id", { count: "exact", head: true }).eq("candidate_id", cand.id),
      supabaseAdmin.from("resumes").select("source, created_at").eq("candidate_id", cand.id).order("created_at", { ascending: false }).limit(5),
    ]);
    return Response.json({
      role,
      stats: [
        { label: "Resume versions", value: resumes ?? 0, prompt: "Show all my resume versions" },
        { label: "Applications", value: apps?.length ?? 0, prompt: "Show my applications" },
        { label: "Offers waiting", value: countOf(offers, "status", "sent"), prompt: "Show my offers" },
        { label: "Accepted", value: countOf(offers, "status", "accepted") + countOf(offers, "status", "joined"), prompt: "Show my offers" },
      ],
      lists: [
        {
          title: "My offers",
          items: (offers ?? []).map((o) => {
            const job = rel<Named>(o.jobs); const co = rel<Named>(o.companies);
            return { title: `${job?.title} — ${co?.name}`, status: o.status, prompt: o.status === "sent" ? `Accept the ${job?.title} offer from ${co?.name}` : "Show my offers" };
          }),
        },
        {
          title: "My resume versions",
          items: (versions ?? []).map((v, i) => ({
            title: `Version ${(resumes ?? 0) - i}${i === 0 ? " (current)" : ""}`,
            note: new Date(v.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
            status: v.source,
            prompt: "Show all my resume versions",
          })),
        },
        {
          title: "My applications",
          items: (apps ?? []).map((a) => {
            const job = rel<Named & { companies: Named }>(a.jobs);
            return { title: `${job?.title} — ${rel<Named>(job?.companies)?.name}`, status: a.status, prompt: "Show my applications" };
          }),
        },
      ],
      agentActivity,
    });
  }

  if (role === "employer") {
    const { data: co } = await supabaseAdmin.from("companies").select("id").eq("owner_id", ctx.userId).maybeSingle();
    if (!co) return Response.json({ role, stats: [], lists: [], agentActivity });
    const [{ data: jobs }, { data: offers }] = await Promise.all([
      supabaseAdmin.from("jobs").select("id, title, status, applications(count)").eq("company_id", co.id).order("created_at", { ascending: false }),
      supabaseAdmin.from("offers").select("status, jobs(title), candidates(full_name, score)").eq("company_id", co.id).order("created_at", { ascending: false }),
    ]);
    const applicants = (jobs ?? []).reduce((n, j) => n + ((j.applications as { count: number }[])?.[0]?.count ?? 0), 0);
    return Response.json({
      role,
      stats: [
        { label: "Open jobs", value: countOf(jobs, "status", "open"), prompt: "Show my jobs" },
        { label: "Applicants", value: applicants, prompt: "Show applicants for all my jobs" },
        { label: "Offers sent", value: offers?.length ?? 0, prompt: "Show my offers" },
        { label: "Joined", value: countOf(offers, "status", "joined"), prompt: "Show my offers" },
      ],
      lists: [
        {
          title: "My jobs",
          items: (jobs ?? []).map((j) => ({
            title: j.title, status: j.status,
            note: `${(j.applications as { count: number }[])?.[0]?.count ?? 0} applicants`,
            prompt: `Show applicants for the ${j.title} job`,
          })),
        },
        {
          title: "Offers & status",
          items: (offers ?? []).map((o) => {
            const c = rel<Named>(o.candidates); const job = rel<Named>(o.jobs);
            return { title: `${c?.full_name} — ${job?.title}`, status: o.status, note: `score ${c?.score}`, prompt: "Show my offers" };
          }),
        },
      ],
      agentActivity,
    });
  }

  // Recruitment firm: platform-wide view + risk watchlist.
  const [{ data: offers }, { data: jobs }, { count: cands }, { data: watch }, { data: lowCos }] = await Promise.all([
    supabaseAdmin.from("offers").select("status"),
    supabaseAdmin.from("jobs").select("title, location, companies(name)").eq("status", "open").order("created_at", { ascending: false }).limit(8),
    supabaseAdmin.from("candidates").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("candidates").select("full_name, current_title, score").lt("score", 100).order("score").limit(6),
    supabaseAdmin.from("companies").select("name, score").lt("score", 100).order("score").limit(6),
  ]);
  return Response.json({
    role,
    stats: [
      { label: "Candidates", value: cands ?? 0, prompt: "Find me candidates" },
      { label: "Open jobs", value: jobs?.length ?? 0, prompt: "Show me open jobs" },
      { label: "Offers accepted", value: countOf(offers, "status", "accepted") + countOf(offers, "status", "joined"), prompt: "Show my pipeline" },
      { label: "No-shows", value: countOf(offers, "status", "no_show"), prompt: "Show my pipeline" },
    ],
    lists: [
      {
        title: "Open jobs to fill",
        items: (jobs ?? []).map((j) => ({
          title: `${j.title} — ${rel<Named>(j.companies)?.name}`, note: j.location ?? "", status: "open",
          prompt: `Find candidates for the ${j.title} job in ${j.location ?? ""}`,
        })),
      },
      {
        title: "Watchlist (score below 100)",
        items: [
          ...(watch ?? []).map((c) => ({ title: c.full_name, note: c.current_title ?? "Candidate", status: `score ${c.score}`, prompt: `Check the score of candidate ${c.full_name}` })),
          ...(lowCos ?? []).map((c) => ({ title: c.name, note: "Employer", status: `score ${c.score}`, prompt: `What is the score of ${c.name}?` })),
        ],
      },
    ],
    agentActivity,
  });
}
