"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { apiFetch } from "@/lib/api";

const TABS = [
  { id: "resumes", label: "Resumes" },
  { id: "offers", label: "Offers" },
  { id: "acceptances", label: "Acceptances" },
  { id: "hiring", label: "Hiring records" },
  { id: "scores", label: "Score events" },
  { id: "candidates", label: "Candidates", hideFor: "candidate" },
  { id: "companies", label: "Companies" },
  { id: "activity", label: "AI agent log" },
];

export default function DataLake() {
  const router = useRouter();
  const [tab, setTab] = useState("resumes");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [role, setRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (t: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.replace("/login");
    setLoading(true);
    setError("");
    const res = await apiFetch(`/api/data-lake?tab=${t}`);
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setRows([]);
      return setError(json.error);
    }
    setRole(json.role);
    setRows(json.rows);
  }, [router]);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const cols = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
        <div className="font-bold text-lg">Hire<span className="text-indigo-600">Speak</span> <span className="font-normal text-gray-400">/ Data lake</span></div>
        <Link href="/dashboard" className="text-sm text-indigo-600 font-medium hover:underline">← Dashboard</Link>
      </header>
      <main className="p-4 sm:p-6 space-y-4">
        <p className="text-sm text-gray-600">
          One central store for every resume, offer, acceptance, hiring record and score.
          {role === "recruiter" ? " As a recruitment firm you can see all records." : " You see the records that belong to you."} Aadhaar is never shown in full.
        </p>
        <div className="flex flex-wrap gap-2">
          {TABS.filter((t) => t.hideFor !== role).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 hover:bg-gray-50"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white overflow-x-auto">
          {loading ? (
            <div className="p-6 text-sm text-gray-400">Loading…</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : !rows.length ? (
            <div className="p-6 text-sm text-gray-400">No records yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>{cols.map((c) => <th key={c} className="px-3 py-2 font-medium whitespace-nowrap">{c.replace(/_/g, " ")}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i} className="align-top">
                    {cols.map((c) => <td key={c} className="px-3 py-2 max-w-xs">{String(r[c] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="text-xs text-gray-400">{rows.length} record{rows.length === 1 ? "" : "s"}</div>
      </main>
    </div>
  );
}
