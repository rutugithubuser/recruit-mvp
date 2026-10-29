// Shared types for all agents. Safe to import (as types) from client code.
import type { AuthContext } from "../auth";

export type CardAction = { label: string; prompt: string };

export type Card = {
  type: "job" | "candidate" | "company" | "firm" | "resume" | "offer" | "acceptance" | "score" | "info";
  title: string;
  subtitle?: string;
  body?: string;
  meta?: Record<string, string | number | null | undefined>;
  id?: string;
  // Clicking an action sends its prompt to the chat, so users never fill fields.
  actions?: CardAction[];
};

export type AgentResult = {
  agent: string;
  intent: string;
  reply: string;
  cards?: Card[];
  data?: unknown;
};

export type ChatTurn = { from: "user" | "agent"; text: string };

export type Entities = {
  title?: string;
  location?: string;
  min_experience_years?: number;
  salary?: number;
  skills?: string[];
  industry?: string;
  person_name?: string;
  company_name?: string;
  aadhaar?: string;
  reference?: string;
  joining_date?: string;
  details?: string;
};

export type Intent = { intent: string; entities: Entities };

export type InputVia = "voice" | "text";

export type AgentInput = {
  ctx: AuthContext;
  message: string;
  history: ChatTurn[];
  intent: Intent;
  via: InputVia;
};

export type AgentHandler = (input: AgentInput) => Promise<AgentResult>;
