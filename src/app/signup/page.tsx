"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import AuthLayout from "@/components/AuthLayout";
import Icon, { type IconName } from "@/components/ui/Icon";

const ROLES: { id: "candidate" | "employer" | "recruiter"; label: string; text: string; icon: IconName }[] = [
  { id: "candidate", label: "Candidate", text: "Find jobs, build a resume by voice", icon: "user" },
  { id: "employer", label: "Employer", text: "Post jobs, find people, send offers", icon: "building" },
  { id: "recruiter", label: "Recruitment firm", text: "Source candidates, check scores", icon: "users" },
];

export default function SignupPage() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof ROLES)[number]["id"]>("candidate");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(data.error);
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/dashboard");
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted">This is the only form you&apos;ll fill. Everything else is voice or text.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <span className="label">I am a</span>
          <div className="grid gap-2" role="radiogroup">
            {ROLES.map((r) => (
              <button type="button" key={r.id} onClick={() => setRole(r.id)} role="radio" aria-checked={role === r.id}
                className={`flex items-center gap-3 rounded-tile border px-3.5 py-3 text-left transition ${
                  role === r.id ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2"}`}>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-control ${role === r.id ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}>
                  <Icon name={r.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block text-xs text-muted">{r.text}</span>
                </span>
                <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${role === r.id ? "border-primary bg-primary shadow-[inset_0_0_0_2px_var(--surface)]" : "border-line"}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="name">{role === "candidate" ? "Full name" : "Your name"}</label>
          <input id="name" className="input" placeholder="e.g. Rahul Mehta" autoComplete="name"
            value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" placeholder="you@company.com" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" placeholder="At least 6 characters" autoComplete="new-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        {error && <p className="rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? "Creating your account…" : "Create account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium text-primary hover:underline">Log in</Link>
      </p>
    </AuthLayout>
  );
}
