"use client";
// Signed-in layout: sidebar navigation (desktop), slide-in menu (mobile), top bar with theme + user.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import { ROLE_LABEL, initials, type Role } from "@/lib/ui";
import Icon, { type IconName } from "./ui/Icon";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

export type ShellUser = { name: string | null; email: string | null; role: Role };

type NavLink = { label: string; icon: IconName; href: string };

const MAIN: NavLink[] = [
  { label: "Assistant", icon: "dashboard", href: "/dashboard" },
  { label: "Data lake", icon: "database", href: "/data-lake" },
];

// Shortcuts open the assistant and run the request for you.
const ask = (q: string) => `/dashboard?ask=${encodeURIComponent(q)}`;
const SHORTCUTS: Record<Role, NavLink[]> = {
  candidate: [
    { label: "My resume", icon: "file", href: ask("Show all my resume versions") },
    { label: "Find jobs", icon: "search", href: ask("Find jobs that match my resume") },
    { label: "Applications", icon: "clipboard", href: ask("Show my applications") },
    { label: "Offers", icon: "mail", href: ask("Show my offers") },
    { label: "Trust score", icon: "shield", href: ask("What is my score?") },
  ],
  employer: [
    { label: "Company profile", icon: "building", href: ask("Show my company profile") },
    { label: "My jobs", icon: "briefcase", href: ask("Show my jobs") },
    { label: "Applicants", icon: "users", href: ask("Show applicants for all my jobs") },
    { label: "Offers", icon: "mail", href: ask("Show my offers") },
    { label: "Trust score", icon: "shield", href: ask("What is my score?") },
  ],
  recruiter: [
    { label: "Firm profile", icon: "building", href: ask("Show my firm profile") },
    { label: "Find candidates", icon: "users", href: ask("Find me candidates") },
    { label: "Open jobs", icon: "briefcase", href: ask("Show me open jobs") },
    { label: "Pipeline", icon: "chart", href: ask("Show my pipeline") },
  ],
};

export default function AppShell({
  user, title, subtitle, children,
}: { user: ShellUser | null; title: string; subtitle?: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const nav = (
    <nav className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-1">
        <Logo href="/dashboard" small />
        <button className="btn-ghost h-9 w-9 !px-0 lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
          <Icon name="x" />
        </button>
      </div>

      <div className="space-y-1">
        <div className="eyebrow px-3 pb-1">Workspace</div>
        {MAIN.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href}
              className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium transition ${
                active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-2 hover:text-fg"}`}>
              <Icon name={l.icon} /> {l.label}
            </Link>
          );
        })}
      </div>

      {user && (
        <div className="space-y-1">
          <div className="eyebrow px-3 pb-1">Shortcuts</div>
          {SHORTCUTS[user.role].map((l) => (
            <Link key={l.label} href={l.href}
              className="group flex items-center gap-3 rounded-control px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-fg">
              <Icon name={l.icon} /> <span className="flex-1">{l.label}</span>
              <Icon name="chevron" className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60" />
            </Link>
          ))}
        </div>
      )}

      <div className="mt-auto rounded-tile border border-line bg-surface-2/60 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold"><Icon name="sparkles" className="h-3.5 w-3.5 text-primary" /> Tip</div>
        <p className="mt-1 text-xs leading-relaxed text-muted">Tap the mic and just say what you need. AI agents fill everything in for you.</p>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">{nav}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-xl">{nav}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
          <button className="btn-ghost h-9 w-9 !px-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
            {subtitle && <p className="hidden truncate text-xs text-muted sm:block">{subtitle}</p>}
          </div>
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-3 border-l border-line pl-3">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight">{user.name}</div>
                <div className="text-[11px] text-muted">{ROLE_LABEL[user.role]}</div>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary" title={user.email ?? ""}>
                {initials(user.name)}
              </span>
              <button onClick={logout} className="btn-ghost h-9 w-9 !px-0" title="Log out" aria-label="Log out">
                <Icon name="logout" />
              </button>
            </div>
          )}
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
