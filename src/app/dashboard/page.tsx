"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { apiFetch } from "@/lib/api";
import ChatPanel from "@/components/ChatPanel";

type Role = "candidate" | "employer" | "recruiter";
type Me = { profile: { id: string; role: Role; full_name: string | null }; email: string | null; entity: Record<string, unknown> | null };
type Dash = {
  stats: { label: string; value: number }[];
  lists: { title: string; items: { title: string; status?: string; note?: string; prompt?: string }[] }[];
  agentActivity: { agent: string; at: string; summary: string }[];
};
type Action = { label: string; prompt?: string; hint?: string };

const ROLE_LABEL: Record<Role, string> = { candidate: "Candidate", employer: "Employer", recruiter: "Recruitment firm" };

// Quick actions = the "auto-generate" buttons. Each one either speaks for you or opens the mic with a hint.
const ACTIONS: Record<Role, Action[]> = {
  candidate: [
    { label: "📝 Generate resume", hint: "Say your name, role, years of experience, skills, past companies, area and expected salary" },
    { label: "🔍 Jobs for me", prompt: "Find jobs that match my resume" },
    { label: "✅ Accept an offer", prompt: "Show my offers" },
    { label: "📋 Application status", prompt: "Show my applications" },
    { label: "⭐ My score", prompt: "What is my score?" },
    { label: "🏢 Check a company", hint: "Say the company name whose score you want to check" },
  ],
  employer: [
    { label: "🏢 Company profile", hint: "Say your company name, what it does, where it is and how many people work there" },
    { label: "📝 Generate job description", hint: "Say the role, area, experience needed, key skills and salary" },
    { label: "🔍 Find candidates", hint: "Describe who you need, e.g. a CA with 2 years at an SME in Mumbai" },
    { label: "✉️ Generate offer letter", hint: "Say the candidate's name, the job, salary and joining date" },
    { label: "👥 Applicants", prompt: "Show applicants for all my jobs" },
    { label: "📊 Offer status", prompt: "Show my offers" },
    { label: "⭐ Check candidate score", hint: "Say the candidate's name, their company, or their Aadhaar number" },
  ],
  recruiter: [
    { label: "🏢 Firm profile", hint: "Say your firm's name and what kind of roles you place" },
    { label: "🔍 Find candidates", hint: "Describe who your client needs" },
    { label: "💼 Open jobs", hint: "Say what kind of jobs you're looking to fill" },
    { label: "📊 Pipeline", prompt: "Show my pipeline" },
    { label: "⭐ Check score", hint: "Say a candidate's name, company or Aadhaar number, or a company name" },
  ],
};

const SUGGESTIONS: Record<Role, string[]> = {
  candidate: [
    "Make my resume: I'm an accountant with 3 years in Tally and GST, based in Andheri East",
    "Find me an accountant's job in Andheri East that pays Rs 30,000",
  ],
  employer: [
    "Create my company profile: Sharma Industries, 50-person auto parts maker in Bhiwandi",
    "Find me a CA who has 2 years of experience with an SME, based in Mumbai, from manufacturing",
  ],
  recruiter: [
    "Set up my firm: TalentBridge, we place finance staff for Mumbai SMEs",
    "Find me a CA with 2 years experience in Mumbai",
  ],
};

const STATUS_STYLE: Record<string, string> = {
  open: "bg-green-100 text-green-700", applied: "bg-blue-100 text-blue-700", shortlisted: "bg-indigo-100 text-indigo-700",
  offered: "bg-pink-100 text-pink-700", sent: "bg-amber-100 text-amber-700", accepted: "bg-green-100 text-green-700",
  joined: "bg-emerald-100 text-emerald-800", declined: "bg-gray-100 text-gray-600", no_show: "bg-red-100 text-red-700",
  revoked: "bg-red-100 text-red-700", rejected: "bg-gray-100 text-gray-600", closed: "bg-gray-100 text-gray-600",
};
const STATUS_TEXT: Record<string, string> = { sent: "waiting", no_show: "didn't join", revoked: "withdrawn", offered: "offer sent" };

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [command, setCommand] = useState<{ id: number; prompt?: string; hint?: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.replace("/login");
    const [meRes, dashRes] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/dashboard")]);
    if (!meRes.ok) {
      await supabase.auth.signOut();
      return router.replace("/login");
    }
    setMe(await meRes.json());
    if (dashRes.ok) setDash(await dashRes.json());
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const run = (a: { prompt?: string; hint?: string }) => setCommand({ id: Date.now(), ...a });

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!me) return <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>;

  const role = me.profile.role;
  const e = me.entity;
  const score = (e?.score as number | undefined) ?? null;

  return (
    <div className="flex-1 flex flex-col lg:h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
        <div className="font-bold text-lg">Hire<span className="text-indigo-600">Speak</span></div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/data-lake" className="text-indigo-600 font-medium hover:underline">Data lake</Link>
          <span className="hidden sm:inline text-gray-600">{me.profile.full_name}</span>
          <span className="rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-xs font-semibold">{ROLE_LABEL[role]}</span>
          <button onClick={logout} className="text-gray-500 hover:text-gray-900">Log out</button>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-5 gap-4 p-4 min-h-0">
        <section className="lg:col-span-3 h-[75vh] lg:h-auto min-h-0">
          <ChatPanel suggestions={SUGGESTIONS[role]} onResult={() => load()} allowUpload={role === "candidate"} command={command} />
        </section>

        <aside className="lg:col-span-2 space-y-4 lg:overflow-y-auto pb-4">
          {/* Profile + score */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-gray-500">{role === "candidate" ? "Your profile" : role === "employer" ? "Company" : "Firm"}</div>
                <div className="font-semibold text-lg truncate">
                  {String(e?.name ?? e?.full_name ?? "Not set up yet")}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {[e?.current_title, e?.industry, e?.location].filter(Boolean).map(String).join(" · ")}
                </div>
              </div>
              {role !== "recruiter" && (
                <div className="text-right shrink-0">
                  <div className="text-xs text-gray-500">Trust score</div>
                  <div className={`text-3xl font-bold ${score !== null && score < 100 ? (score < 85 ? "text-red-600" : "text-amber-600") : "text-gray-900"}`}>
                    {score ?? "—"}
                  </div>
                </div>
              )}
            </div>
            {!e?.description && !e?.current_title && (
              <button onClick={() => run({ hint: ACTIONS[role][0].hint })}
                className="mt-3 w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white">
                {role === "candidate" ? "🎤 Create my resume by voice" : "🎤 Set up my profile by voice"}
              </button>
            )}
          </div>

          {/* Stats */}
          {dash && dash.stats.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2">
              {dash.stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Quick actions */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-sm font-semibold mb-2">Quick actions <span className="font-normal text-gray-400">— AI does the work</span></div>
            <div className="flex flex-wrap gap-2">
              {ACTIONS[role].map((a) => (
                <button key={a.label} onClick={() => run(a)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:border-indigo-400 hover:bg-indigo-50">
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lists with status */}
          {dash?.lists.map((l) => (
            <div key={l.title} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold mb-2">{l.title}</div>
              {l.items.length === 0 ? (
                <div className="text-xs text-gray-400">Nothing yet.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {l.items.slice(0, 6).map((it, i) => (
                    <li key={i}>
                      <button onClick={() => it.prompt && run({ prompt: it.prompt })}
                        className="w-full flex items-center justify-between gap-2 py-2 text-left hover:bg-gray-50 rounded px-1">
                        <span className="min-w-0">
                          <span className="block text-sm truncate">{it.title}</span>
                          {it.note && <span className="block text-xs text-gray-400 truncate">{it.note}</span>}
                        </span>
                        {it.status && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[it.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {STATUS_TEXT[it.status] ?? it.status}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {/* Agent activity */}
          {dash && dash.agentActivity.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold mb-2">🤖 Recent AI agent work</div>
              <ul className="space-y-1.5">
                {dash.agentActivity.map((a, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-medium text-indigo-700">{a.agent.replace(/_/g, " ")}</span>
                    <span className="text-gray-400"> · {new Date(a.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                    <div className="text-gray-600 truncate">{a.summary}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
