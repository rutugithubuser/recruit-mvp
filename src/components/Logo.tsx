import Link from "next/link";

export default function Logo({ href = "/", small = false }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight text-fg">
      <span className={`grid place-items-center rounded-[10px] bg-primary text-on-primary ${small ? "h-7 w-7" : "h-8 w-8"}`}>
        <svg viewBox="0 0 24 24" className={small ? "h-4 w-4" : "h-[18px] w-[18px]"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 9v6M9 6v12M13 9v6M17 7v10M21 11v2" />
        </svg>
      </span>
      <span className={small ? "text-base" : "text-lg"}>
        Hire<span className="text-primary">Speak</span>
      </span>
    </Link>
  );
}
