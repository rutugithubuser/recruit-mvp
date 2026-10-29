"use client";
import { useState } from "react";
import type { Card } from "@/lib/agents/types";

const COLORS: Record<Card["type"], string> = {
  job: "bg-blue-50 text-blue-700",
  candidate: "bg-emerald-50 text-emerald-700",
  company: "bg-amber-50 text-amber-700",
  firm: "bg-amber-50 text-amber-700",
  resume: "bg-purple-50 text-purple-700",
  offer: "bg-pink-50 text-pink-700",
  acceptance: "bg-green-50 text-green-700",
  score: "bg-orange-50 text-orange-700",
  info: "bg-gray-100 text-gray-700",
};

export default function ResultCard({ card, onAction }: { card: Card; onAction: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const long = (card.body?.length ?? 0) > 280;
  const meta = Object.entries(card.meta ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== "");
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-gray-900">{card.title}</div>
          {card.subtitle && <div className="text-gray-500">{card.subtitle}</div>}
        </div>
        {card.type !== "info" && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${COLORS[card.type]}`}>{card.type}</span>
        )}
      </div>
      {meta.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {meta.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-gray-400 capitalize">{k.replace(/_/g, " ")}</dt>
              <dd className="text-gray-800 truncate">{String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.body && (
        <div className="mt-2">
          <p className={`whitespace-pre-wrap text-gray-700 ${long && !open ? "line-clamp-4" : ""}`}>{card.body}</p>
          {long && (
            <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-medium text-indigo-600 hover:underline">
              {open ? "Show less ▲" : "Show full ▼"}
            </button>
          )}
        </div>
      )}
      {card.actions && card.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.actions.map((a) => (
            <button key={a.label + a.prompt} onClick={() => onAction(a.prompt)}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
