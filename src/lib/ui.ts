// Shared UI helpers: roles, status labels and theme-aware status colours.
export type Role = "candidate" | "employer" | "recruiter";

export const ROLE_LABEL: Record<Role, string> = {
  candidate: "Candidate",
  employer: "Employer",
  recruiter: "Recruitment firm",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open", closed: "Closed", applied: "Applied", shortlisted: "Shortlisted", offered: "Offer sent",
  rejected: "Not selected", withdrawn: "Withdrawn", sent: "Awaiting reply", accepted: "Accepted",
  declined: "Declined", joined: "Joined", no_show: "Didn't join", revoked: "Withdrawn",
  pending: "Pending", confirmed: "Confirmed", disputed: "Disputed", active: "Active",
  left_without_notice: "Left w/o notice", fired_without_notice: "Fired w/o notice",
  voice: "Voice", text: "Text", upload: "Upload", whatsapp: "WhatsApp",
};

const TONE: Record<string, string> = {
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  blue: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  red: "bg-red-500/12 text-red-700 dark:text-red-300",
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  gray: "bg-surface-2 text-muted",
};

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  open: "green", active: "green", accepted: "green", joined: "green", confirmed: "red",
  applied: "blue", shortlisted: "blue", offered: "violet", sent: "amber", pending: "amber", disputed: "violet",
  declined: "gray", closed: "gray", rejected: "gray", withdrawn: "gray",
  no_show: "red", revoked: "red", left_without_notice: "red", fired_without_notice: "red",
  voice: "violet", text: "violet", upload: "violet", whatsapp: "green",
};

export function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s.replace(/_/g, " ");
}

export function statusClass(s: string) {
  return TONE[STATUS_TONE[s] ?? (/^score/.test(s) ? "amber" : "gray")];
}

export function scoreTone(score: number | null | undefined) {
  if (score === null || score === undefined) return "text-fg";
  if (score >= 95) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 85) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function initials(name?: string | null) {
  return (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}
