"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/browser";
import { apiFetch } from "@/lib/api";
import ChatPanel from "@/components/ChatPanel";

type Me = {
  profile: { id: string; role: "candidate" | "employer" | "recruiter"; full_name: string | null };
  email: string | null;
  entity: Record<string, unknown> | null;
};

const ROLE_LABEL = { candidate: "Candidate", employer: "Employer", recruiter: "Recruitment firm" };

const SUGGESTIONS = {
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

export default function Dashboard() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const loadMe = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return router.replace("/login");
    const res = await apiFetch("/api/me");
    if (!res.ok) {
      await supabase.auth.signOut();
      return router.replace("/login");
    }
    setMe(await res.json());
  }, [router]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!me) return <div className="flex-1 flex items-center justify-center text-gray-400">Loading…</div>;

  const role = me.profile.role;
  const score = (me.entity?.score as number | undefined) ?? null;

  return (
    <div className="flex-1 flex flex-col h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 py-3">
        <div className="font-bold text-lg">Hire<span className="text-indigo-600">Speak</span></div>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline text-gray-600">{me.profile.full_name}</span>
          <span className="rounded-full bg-indigo-100 text-indigo-700 px-2.5 py-0.5 text-xs font-semibold">{ROLE_LABEL[role]}</span>
          <button onClick={logout} className="text-gray-500 hover:text-gray-900">Log out</button>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-5 gap-4 p-4 min-h-0">
        <section className="lg:col-span-3 min-h-[60vh] lg:min-h-0">
          <ChatPanel suggestions={SUGGESTIONS[role]} onResult={() => loadMe()} />
        </section>

        <aside className="lg:col-span-2 space-y-4 overflow-y-auto">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="text-sm text-gray-500">Trust score</div>
            <div className="text-4xl font-bold mt-1">{score ?? "—"}</div>
            <p className="text-xs text-gray-500 mt-2">
              {score === null
                ? role === "candidate"
                  ? "Your score appears once your profile is created."
                  : "Create your profile by voice or text to get a score."
                : "Everyone starts at 100. Each confirmed no-show or exit without notice is −5."}
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-sm text-gray-500">
            Dashboard widgets (jobs, applications, offers, status) are added in the next build step.
          </div>
        </aside>
      </main>
    </div>
  );
}
