"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { apiFetch } from "@/lib/api";
import AppShell, { type ShellUser } from "@/components/AppShell";
import Icon, { type IconName } from "@/components/ui/Icon";
import { statusClass, statusLabel } from "@/lib/ui";

const TABS: { id: string; label: string; icon: IconName; hideFor?: string }[] = [
  { id: "resumes", label: "Resumes", icon: "file" },
  { id: "offers", label: "Offers", icon: "mail" },
  { id: "acceptances", label: "Acceptances", icon: "check" },
  { id: "hiring", label: "Hiring records", icon: "briefcase" },
  { id: "scores", label: "Score events", icon: "shield" },
  { id: "candidates", label: "Candidates", icon: "users", hideFor: "candidate" },
  { id: "companies", label: "Companies", icon: "building" },
  { id: "activity", label: "AI agent log", icon: "bot" },
];

const PILL_COLS = new Set(["status", "source", "type"]);

export default function DataLake() {
  const router = useRouter();
  const [user, setUser] = useState<ShellUser | null>(null);
  const [tab, setTab] = useState("resumes");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return router.replace("/login");
      const res = await apiFetch("/api/me");
      if (!res.ok) return router.replace("/login");
      const me = await res.json();
      setUser({ name: me.profile.full_name, email: me.email, role: me.profile.role });
    })();
  }, [router]);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    setError("");
    const res = await apiFetch(`/api/data-lake?tab=${t}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setRows([]);
      return setError(json.error);
    }
    setRows(json.rows);
  }, []);

  useEffect(() => {
    load(tab);
    setQuery("");
  }, [tab, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [rows, query]);

  const cols = rows.length ? Object.keys(rows[0]) : [];
  const role = user?.role;

  return (
    <AppShell user={user} title="Central data lake"
      subtitle="Every resume, offer, acceptance, hiring record, score and AI action in one place">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="card flex items-start gap-3 p-4 text-sm">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-primary-soft text-primary"><Icon name="database" /></span>
          <p className="text-muted">
            {role === "recruiter"
              ? "As a recruitment firm you can see all records across the platform."
              : "You see the records that belong to you."}{" "}
            Aadhaar numbers are never stored. Only a secure hash and the last 4 digits are kept.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
            {TABS.filter((t) => t.hideFor !== role).map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  tab === t.id ? "bg-fg text-bg" : "border border-line bg-surface text-muted hover:text-fg"}`}>
                <Icon name={t.icon} className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter records…" className="input !pl-9" />
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-control bg-surface-2" />)}</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted">
              <Icon name="database" className="h-6 w-6" />
              {rows.length ? "No records match your filter." : "No records yet. They appear here as the AI agents create them."}
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2 text-left">
                  <tr>{cols.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{c.replace(/_/g, " ")}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((r, i) => (
                    <tr key={i} className="align-top transition hover:bg-surface-2/50">
                      {cols.map((c) => {
                        const v = String(r[c] ?? "");
                        return (
                          <td key={c} className="max-w-xs px-4 py-2.5">
                            {PILL_COLS.has(c) && v ? (
                              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(v)}`}>{statusLabel(v)}</span>
                            ) : c === "score" ? (
                              <span className="font-semibold tabular-nums">{v}</span>
                            ) : (
                              <span className="line-clamp-2">{v}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="text-xs text-muted">{filtered.length} of {rows.length} record{rows.length === 1 ? "" : "s"}</div>
      </div>
    </AppShell>
  );
}
