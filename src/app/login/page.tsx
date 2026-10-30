"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import AuthLayout from "@/components/AuthLayout";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return setError(error.message === "Invalid login credentials" ? "Wrong email or password." : error.message);
    router.push("/dashboard");
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to your VoxHire workspace.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" placeholder="you@company.com" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" placeholder="Your password" autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="rounded-control bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? "Logging in…" : "Log in"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to VoxHire? <Link href="/signup" className="font-medium text-primary hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
