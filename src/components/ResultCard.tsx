"use client";
import { useState } from "react";
import type { Card } from "@/lib/agents/types";
import Icon, { type IconName } from "./ui/Icon";
import { statusClass } from "@/lib/ui";

const TYPE: Record<Card["type"], { icon: IconName; label: string }> = {
  job: { icon: "briefcase", label: "Job" },
  candidate: { icon: "user", label: "Candidate" },
  company: { icon: "building", label: "Company" },
  firm: { icon: "building", label: "Firm" },
  resume: { icon: "file", label: "Resume" },
  offer: { icon: "mail", label: "Offer" },
  acceptance: { icon: "check", label: "Accepted" },
  score: { icon: "shield", label: "Trust score" },
  info: { icon: "sparkles", label: "" },
};

const isStatusKey = (k: string) => k === "status";

export default function ResultCard({ card, onAction }: { card: Card; onAction: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const long = (card.body?.length ?? 0) > 280;
  const meta = Object.entries(card.meta ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  const t = TYPE[card.type];
  const match = meta.find(([k]) => k === "match")?.[1];
  const rest = meta.filter(([k]) => k !== "match");

  return (
    <div className="card p-4 text-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-tile bg-surface-2 text-muted">
          <Icon name={t.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-snug">{card.title}</div>
          {card.subtitle && <div className="mt-0.5 text-xs text-muted">{card.subtitle}</div>}
        </div>
        {match ? (
          <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{String(match)} match</span>
        ) : t.label ? (
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{t.label}</span>
        ) : null}
      </div>

      {rest.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-tile bg-surface-2/60 p-3 sm:grid-cols-3">
          {rest.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] capitalize text-muted">{k.replace(/_/g, " ")}</dt>
              <dd className="truncate font-medium">
                {isStatusKey(k) ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(String(v).toLowerCase().replace(/ /g, "_"))}`}>{String(v)}</span>
                ) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {card.body && (
        <div className="mt-3">
          <p className={`whitespace-pre-wrap leading-relaxed text-fg/85 ${long && !open ? "line-clamp-4" : ""}`}>{card.body}</p>
          {long && (
            <button onClick={() => setOpen(!open)} className="mt-1.5 text-xs font-semibold text-primary hover:underline">
              {open ? "Show less" : "Show full"}
            </button>
          )}
        </div>
      )}

      {card.actions && card.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {card.actions.map((a, i) => (
            <button key={a.label + a.prompt} onClick={() => onAction(a.prompt)}
              className={`${i === 0 ? "btn-primary" : "btn-outline"} !px-3 !py-1.5 text-xs`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
