"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/browser";

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
    if (error) return setError(error.message);
    router.push("/dashboard");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white border border-gray-200 p-6 space-y-4">
        <h1 className="text-2xl font-bold">Log in</h1>
        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border border-gray-300 px-3 py-2" type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-600 py-2.5 text-white font-semibold disabled:opacity-60">
          {busy ? "Logging in..." : "Log in"}
        </button>
        <p className="text-sm text-gray-600 text-center">
          New here? <Link href="/signup" className="text-indigo-600 font-medium">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
