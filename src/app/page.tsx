import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import Icon, { type IconName } from "@/components/ui/Icon";

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: "mic", title: "Say it", text: "Speak or type in plain language, on the web or on WhatsApp. English, Hindi or Marathi voice notes work too." },
  { icon: "bot", title: "Agents do the work", text: "Specialist AI agents write the job post, resume, offer or acceptance, and search the whole talent pool." },
  { icon: "check", title: "Review and act", text: "Everything lands as a clear card with one-tap actions: apply, send offer, accept, report." },
];

const ROLES: { icon: IconName; title: string; points: string[] }[] = [
  { icon: "building", title: "Employers", points: ["Company profile and JDs from a sentence", "Ranked candidates with a match %", "Offer letters in seconds", "Check any candidate's trust score"] },
  { icon: "user", title: "Candidates", points: ["Resume from a voice note or any file", "Jobs by area and salary", "Apply and accept by voice", "See an employer's score first"] },
  { icon: "users", title: "Recruitment firms", points: ["Search the whole data lake", "Live hiring pipeline", "Risk watchlist", "Score lookup by name or Aadhaar"] },
];

const RULES = [
  ["Accepted an offer, then didn't join", "Candidate", "−5"],
  ["Gave an offer, then didn't take the candidate", "Employer", "−5"],
  ["Left the job without notice", "Candidate", "−5"],
  ["Fired an employee without notice", "Employer", "−5"],
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Logo />
          <nav className="hidden flex-1 items-center gap-6 text-sm text-muted md:flex">
            <a href="#how" className="hover:text-fg">How it works</a>
            <a href="#roles" className="hover:text-fg">Who it&apos;s for</a>
            <a href="#trust" className="hover:text-fg">Trust score</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="btn-ghost hidden sm:inline-flex">Log in</Link>
            <Link href="/signup" className="btn-primary">Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> AI-native recruiting for SMEs
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Hire and get hired<br />by <span className="gradient-text">just saying it.</span>
              </h1>
              <p className="mt-5 max-w-lg text-lg text-muted">
                No forms. Speak what you need and AI agents write the job post, the resume, the offer and the acceptance, and keep everyone accountable with a trust score.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-primary !px-6 !py-3">Start for free <Icon name="arrow" /></Link>
                <Link href="/login" className="btn-outline !px-6 !py-3">Log in</Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                {["Voice & text", "Works on WhatsApp", "Aadhaar never stored"].map((t) => (
                  <span key={t} className="flex items-center gap-1.5"><Icon name="check" className="h-3.5 w-3.5 text-primary" /> {t}</span>
                ))}
              </div>
            </div>

            {/* Product preview */}
            <div className="card p-4 sm:p-5">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="bot" /></span>
                <div className="text-sm font-semibold">AI assistant</div>
                <span className="ml-auto rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Employer</span>
              </div>
              <div className="space-y-3 py-4 text-sm">
                <div className="ml-auto flex w-fit max-w-[85%] items-start gap-2 rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-on-primary">
                  <Icon name="mic" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Find me a CA with 2 years at an SME in Mumbai who has worked in manufacturing
                </div>
                <div className="w-fit max-w-[85%] rounded-2xl rounded-tl-md bg-surface-2 px-4 py-2.5">I found 2 strong matches out of 15 candidates.</div>
                {[["Priya Shah", "Chartered Accountant · Andheri West", "92%", "100"], ["Amit Joshi", "Chartered Accountant · Thane", "86%", "100"]].map(([n, s, m, sc]) => (
                  <div key={n} className="flex items-center gap-3 rounded-tile border border-line p-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2 text-xs font-semibold">{n.split(" ").map((w) => w[0]).join("")}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{n}</div>
                      <div className="truncate text-xs text-muted">{s} · trust {sc}</div>
                    </div>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{m}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-line pt-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-on-primary"><Icon name="mic" /></span>
                <div className="flex-1 rounded-full border border-line px-4 py-2 text-xs text-muted">Speak or type what you need…</div>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="eyebrow">How it works</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">From a sentence to a signed offer.</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="rounded-card border border-line p-6">
                  <div className="flex items-center justify-between">
                    <span className="grid h-10 w-10 place-items-center rounded-tile bg-primary-soft text-primary"><Icon name={s.icon} className="h-5 w-5" /></span>
                    <span className="text-xs font-semibold text-muted">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roles */}
        <section id="roles" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="eyebrow">Who it&apos;s for</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">One app, three dashboards.</h2>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {ROLES.map((r) => (
                <div key={r.title} className="card p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-tile bg-surface-2"><Icon name={r.icon} className="h-5 w-5" /></span>
                  <h3 className="mt-5 font-semibold">{r.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {r.points.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-muted"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust score */}
        <section id="trust" className="border-t border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
            <div>
              <div className="eyebrow">Trust score</div>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Everyone starts at 100. Promises count.</h2>
              <p className="mt-4 text-muted">
                Backing out costs both sides. Reports against someone can be disputed before they count, and actions you take yourself always come with a warning first. Anyone can look up a score before they commit.
              </p>
            </div>
            <div className="card overflow-hidden">
              {RULES.map(([what, who, pts]) => (
                <div key={what} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400"><Icon name="shield" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{what}</div>
                    <div className="text-xs text-muted">{who}</div>
                  </div>
                  <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">{pts}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight">Your next hire is one sentence away.</h2>
            <p className="mt-3 text-muted">Create an account in under a minute. Everything after that is voice or text.</p>
            <Link href="/signup" className="btn-primary mt-8 !px-6 !py-3">Get started <Icon name="arrow" /></Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:px-6">
          <Logo small />
          <span>MVP prototype · AI-native, voice-first recruiting</span>
        </div>
      </footer>
    </div>
  );
}
