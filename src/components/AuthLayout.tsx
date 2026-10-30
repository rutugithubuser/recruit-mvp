import Link from "next/link";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Icon from "./ui/Icon";

const POINTS = [
  "Job posts, resumes and offer letters written by AI from your voice",
  "Plain-language search: \"a CA with 2 years in Mumbai\"",
  "Trust scores so both sides keep their word",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface p-10 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Hiring for small businesses, <span className="gradient-text">done by just saying it.</span>
          </h2>
          <ul className="mt-6 space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-sm text-muted">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="check" className="h-3 w-3" /></span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">Voice-first · AI-native · Built for Indian SMEs</p>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <span className="lg:hidden"><Logo /></span>
          <Link href="/" className="hidden text-sm text-muted hover:text-fg lg:inline">← Back to home</Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
