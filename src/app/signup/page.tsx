"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";

const ROLES = [
  { id: "candidate", label: "Candidate", text: "Find jobs, build a resume by voice" },
  { id: "employer", label: "Employer", text: "Post jobs, find people, send offers" },
  { id: "recruiter", label: "Recruitment firm", text: "Source candidates, check scores" },
] as const;

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
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-sm text-gray-600">This is the only form you&apos;ll fill. Everything else is voice or text.</p>
        <div className="grid gap-2">
          {ROLES.map((r) => (
            <button type="button" key={r.id} onClick={() => setRole(r.id)}
              className={`text-left rounded-lg border px-4 py-3 ${role === r.id ? "border-indigo-600 bg-indigo-50" : "border-gray-200"}`}>
              <div className="font-semibold">{r.label}</div>
              <div className="text-sm text-gray-600">{r.text}</div>
            </button>
          ))}
        </div>
        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" placeholder="Full name"
          value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="password" placeholder="Password (min 6 characters)"
          value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2.5 text-white font-semibold disabled:opacity-60">
          {busy ? "Creating..." : "Create account"}
        </button>
        <p className="text-sm text-gray-600 text-center">
          Already have an account? <Link href="/login" className="text-indigo-600 font-medium">Log in</Link>
        </p>
      </form>
    </main>
  );
}
