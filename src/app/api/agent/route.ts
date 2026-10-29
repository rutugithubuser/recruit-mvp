import { getAuthContext } from "@/lib/auth";
import { runAgents } from "@/lib/agents";
import type { ChatTurn } from "@/lib/agents/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return Response.json({ error: "Please log in again." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { message?: string; history?: ChatTurn[]; via?: string };
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Say or type something first." }, { status: 400 });

  try {
    const result = await runAgents(ctx, message, (body.history ?? []).slice(-6), body.via === "voice" ? "voice" : "text");
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message || "The AI agent failed. Try again." }, { status: 500 });
  }
}
