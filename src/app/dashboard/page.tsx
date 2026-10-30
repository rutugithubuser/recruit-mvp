"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { apiFetch } from "@/lib/api";
import ChatPanel from "@/components/ChatPanel";
import AppShell from "@/components/AppShell";
import Icon, { type IconName } from "@/components/ui/Icon";
import { ROLE_LABEL, scoreTone, statusClass, statusLabel, type Role } from "@/lib/ui";

type WhatsApp = { linked: boolean; phone: string | null; code: string; number: string; join: string | null };
type Me = { profile: { id: string; role: Role; full_name: string | null }; email: string | null; entity: Record<string, unknown> | null; whatsapp: WhatsApp | null };
type Dash = {
  stats: { label: string; value: number; prompt?: string }[];
  lists: { title: string; items: { title: string; status?: string; note?: string; prompt?: string }[] }[];
  agentActivity: { agent: string; at: string; summary: string }[];
};
type Action = { label: string; icon: IconName; prompt?: string; hint?: string };

// Quick actions = the "auto-generate" buttons. Each one either runs a request or opens the mic with a hint.
const ACTIONS: Record<Role, Action[]> = {
  candidate: [
    { label: "Generate resume", icon: "file", hint: "Say your name, role, years of experience, skills, past companies, area and expected salary" },
    { label: "Jobs for me", icon: "search", prompt: "Find jobs that match my resume" },
    { label: "Accept an offer", icon: "check", prompt: "Show my offers" },
    { label: "Application status", icon: "clipboard", prompt: "Show my applications" },
    { label: "Check a company", icon: "shield", hint: "Say the company name whose trust score you want to check" },
  ],
  employer: [
    { label: "Company profile", icon: "building", hint: "Say your company name, what it does, where it is and how many people work there" },
    { label: "Generate job description", icon: "briefcase", hint: "Say the role, area, experience needed, key skills and salary" },
    { label: "Find candidates", icon: "search", hint: "Describe who you need, e.g. a CA with 2 years at an SME in Mumbai" },
    { label: "Generate offer letter", icon: "mail", hint: "Say the candidate's name, the job, salary and joining date" },
    { label: "Offer status", icon: "chart", prompt: "Show my offers" },
    { label: "Check candidate score", icon: "shield", hint: "Say the candidate's name, their company, or their Aadhaar number" },
  ],
  recruiter: [
    { label: "Firm profile", icon: "building", hint: "Say your firm's name and what kind of roles you place" },
    { label: "Find candidates", icon: "search", hint: "Describe who your client needs" },
    { label: "Open jobs", icon: "briefcase", hint: "Say what kind of jobs you're looking to fill" },
    { label: "Pipeline", icon: "chart", prompt: "Show my pipeline" },
    { label: "Check a score", icon: "shield", hint: "Say a candidate's name, company or Aadhaar number, or a company name" },
  ],
};

const SUGGESTIONS: Record<Role, string[]> = {
  candidate: [
    "Make my resume: I'm an accountant with 3 years in Tally and GST, based in Andheri East",
    "Find me an accountant's job in Andheri East that pays Rs 30,000",
    "What can you do?",
  ],
  employer: [
    "Create my company profile: Sharma Industries, 50-person auto parts maker in Bhiwandi",
    "Find me a CA who has 2 years of experience with an SME, based in Mumbai, from manufacturing",
    "What can you do?",
  ],
  recruiter: [
    "Set up my firm: TalentBridge, we place finance staff for Mumbai SMEs",
    "Find me a CA with 2 years experience in Mumbai",
    "What can you do?",
  ],
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
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

  // Sidebar shortcuts arrive as /dashboard?ask=...
  const ask = params.get("ask");
  useEffect(() => {
    if (!ask) return;
    setCommand({ id: Date.now(), prompt: ask });
    router.replace("/dashboard", { scroll: false });
  }, [ask, router]);

  const run = (a: { prompt?: string; hint?: string }) => setCommand({ id: Date.now(), ...a });

  const role = me?.profile.role;
  const e = me?.entity;
  const score = (e?.score as number | undefined) ?? null;
  const user = me ? { name: me.profile.full_name, email: me.email, role: me.profile.role } : null;
  const firstName = me?.profile.full_name?.split(" ")[0] ?? "";

  return (
    <AppShell user={user} title={me ? `${greeting()}${firstName ? `, ${firstName}` : ""}` : "Loading…"}
      subtitle={role ? `${ROLE_LABEL[role]} workspace · speak or type, AI agents do the rest` : undefined}>
      {!me || !role ? (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-5">
          <div className="card h-[70vh] animate-pulse lg:col-span-3" />
          <div className="space-y-4 lg:col-span-2">
            {[0, 1, 2].map((i) => <div key={i} className="card h-32 animate-pulse" />)}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-5">
          <section className="h-[calc(100vh-7rem)] min-h-[520px] lg:sticky lg:top-[5.5rem] lg:col-span-3">
            <ChatPanel suggestions={SUGGESTIONS[role]} onResult={() => load()} allowUpload={role === "candidate"} command={command} />
          </section>

          <aside className="space-y-4 lg:col-span-2">
            {/* Profile + score */}
            <div className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <button className="min-w-0 text-left" title="View full profile"
                  onClick={() => run({ prompt: role === "candidate" ? "Show my resume" : role === "employer" ? "Show my company profile" : "Show my firm profile" })}>
                  <div className="eyebrow">{role === "candidate" ? "Your profile" : role === "employer" ? "Company" : "Firm"}</div>
                  <div className="mt-1 truncate text-lg font-semibold tracking-tight hover:text-primary">{String(e?.name ?? e?.full_name ?? "Not set up yet")}</div>
                  <div className="truncate text-sm text-muted">
                    {[e?.current_title, e?.industry, e?.location].filter(Boolean).map(String).join(" · ") || "Tell the assistant about yourself to get started"}
                  </div>
                </button>
                {role !== "recruiter" && (
                  <button className="shrink-0 rounded-tile border border-line px-3 py-2 text-center transition hover:bg-surface-2" title="See score details"
                    onClick={() => run({ prompt: "What is my score?" })}>
                    <div className="eyebrow">Trust</div>
                    <div className={`text-2xl font-bold tabular-nums ${scoreTone(score)}`}>{score ?? "—"}</div>
                  </button>
                )}
              </div>
              {!e?.description && !e?.current_title && (
                <button onClick={() => run({ hint: ACTIONS[role][0].hint })} className="btn-primary mt-4 w-full">
                  <Icon name="mic" /> {role === "candidate" ? "Create my resume by voice" : "Set up my profile by voice"}
                </button>
              )}
            </div>

            {/* Stats */}
            {dash && dash.stats.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {dash.stats.map((s) => (
                  <button key={s.label} onClick={() => s.prompt && run({ prompt: s.prompt })}
                    className="card group p-4 text-left transition hover:border-primary/40">
                    <div className="text-2xl font-bold tabular-nums tracking-tight">{s.value}</div>
                    <div className="mt-0.5 flex items-center justify-between text-xs text-muted">
                      {s.label} <Icon name="arrow" className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Quick actions */}
            <div className="card p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <div className="text-sm font-semibold">Quick actions</div>
                <div className="text-[11px] text-muted">AI does the work</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ACTIONS[role].map((a) => (
                  <button key={a.label} onClick={() => run(a)}
                    className="flex items-center gap-2 rounded-control border border-line px-3 py-2.5 text-left text-xs font-medium transition hover:border-primary/50 hover:bg-primary-soft">
                    <Icon name={a.icon} className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{a.label}</span>
                    {a.hint && <Icon name="mic" className="ml-auto h-3 w-3 shrink-0 text-muted" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Lists with status */}
            {dash?.lists.map((l) => (
              <div key={l.title} className="card p-4">
                <div className="mb-2 text-sm font-semibold">{l.title}</div>
                {l.items.length === 0 ? (
                  <div className="rounded-control border border-dashed border-line px-3 py-4 text-center text-xs text-muted">Nothing here yet.</div>
                ) : (
                  <ul className="-mx-1 divide-y divide-line">
                    {l.items.slice(0, 6).map((it, i) => (
                      <li key={i}>
                        <button onClick={() => it.prompt && run({ prompt: it.prompt })}
                          className="flex w-full items-center justify-between gap-3 rounded-control px-1 py-2.5 text-left transition hover:bg-surface-2">
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{it.title}</span>
                            {it.note && <span className="block truncate text-xs text-muted">{it.note}</span>}
                          </span>
                          {it.status && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(it.status)}`}>
                              {statusLabel(it.status)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* WhatsApp */}
            {me.whatsapp && (
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"><Icon name="message" className="h-3.5 w-3.5" /></span>
                    WhatsApp
                  </div>
                  {me.whatsapp.linked
                    ? <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Connected {me.whatsapp.phone}</span>
                    : <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">Not connected</span>}
                </div>
                {me.whatsapp.linked ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Text or send voice notes to <b className="text-fg">{me.whatsapp.number}</b>{role === "candidate" ? ", or send your resume PDF or a photo of it" : ""}. The same agents reply on WhatsApp.
                  </p>
                ) : (
                  <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-muted">
                    <li>Save <b className="text-fg">{me.whatsapp.number}</b> and open it in WhatsApp</li>
                    {me.whatsapp.join && <li>Send <code className="rounded bg-surface-2 px-1 text-fg">{me.whatsapp.join}</code> (one-time)</li>}
                    <li>Send <code className="rounded bg-surface-2 px-1 text-fg">LINK {me.whatsapp.code}</code></li>
                  </ol>
                )}
                <a href={`https://wa.me/${me.whatsapp.number.replace("+", "")}?text=${encodeURIComponent(me.whatsapp.linked ? "What can you do?" : me.whatsapp.join ?? `LINK ${me.whatsapp.code}`)}`}
                  target="_blank" rel="noreferrer" className="btn-outline mt-3 w-full !py-2 text-xs">
                  Open WhatsApp <Icon name="arrow" className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {/* Agent activity */}
            {dash && dash.agentActivity.length > 0 && (
              <div className="card p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon name="bot" className="h-4 w-4 text-primary" /> Recent AI agent work</div>
                <ol className="relative space-y-3 border-l border-line pl-4">
                  {dash.agentActivity.map((a, i) => (
                    <li key={i} className="relative text-xs">
                      <span className="absolute -left-[20.5px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-surface" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{a.agent.replace(/_/g, " ")}</span>
                        <span className="text-muted">{new Date(a.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <div className="truncate text-muted">{a.summary}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}
