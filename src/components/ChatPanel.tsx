"use client";
// The main interface: speak or type. Agents do the rest.
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AgentResult, Card, ChatTurn } from "@/lib/agents/types";
import ResultCard from "./ResultCard";
import Icon from "./ui/Icon";

type Msg = { from: "user" | "agent"; text: string; cards?: Card[]; agent?: string; error?: boolean };

const agentName = (a: string) => a.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) + " agent";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ChatPanel({
  suggestions,
  onResult,
  allowUpload = false,
  command,
}: {
  suggestions: string[];
  onResult?: (r: AgentResult) => void;
  allowUpload?: boolean;
  // Dashboard quick actions: send a prompt directly, or open the mic with a hint of what to say.
  command?: { id: number; prompt?: string; hint?: string } | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState("");
  const messagesRef = useRef<Msg[]>(messages);
  const recRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function addResult(result: AgentResult) {
    setMessages((m) => [...m, { from: "agent", text: result.reply, cards: result.cards, agent: result.agent }]);
    onResult?.(result);
  }
  function addError(e: unknown) {
    setMessages((m) => [...m, { from: "agent", text: (e as Error).message || "Something went wrong.", error: true }]);
  }

  async function uploadFile(file: File) {
    if (busy) return;
    setMessages((m) => [...m, { from: "user", text: `Uploaded resume: ${file.name}` }]);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("message", input.trim() || "Here is my resume");
      setInput("");
      const res = await apiFetch("/api/resume/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      addResult(data as AgentResult);
    } catch (e) {
      addError(e);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send(text: string, via: "voice" | "text" = "text") {
    const t = text.trim();
    if (!t || busy) return;
    const history: ChatTurn[] = messagesRef.current.slice(-6).map((m) => ({ from: m.from, text: m.text }));
    setMessages((m) => [...m, { from: "user", text: t }]);
    setInput("");
    setBusy(true);
    try {
      const res = await apiFetch("/api/agent", { method: "POST", body: JSON.stringify({ message: t, history, via }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      addResult(data as AgentResult);
    } catch (e) {
      addError(e);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    startListening();
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((m) => [...m, { from: "agent", text: "Voice input works in Chrome or Edge. You can type instead.", error: true }]);
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      setHint("");
      if (finalText.trim()) send(finalText, "voice");
    };
    rec.onerror = () => {
      setListening(false);
      setHint("");
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  useEffect(() => {
    if (!command) return;
    if (command.prompt) send(command.prompt);
    else if (command.hint) {
      setHint(command.hint);
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.id]);

  const empty = messages.length === 0;

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="bot" /></span>
          <div>
            <div className="text-sm font-semibold leading-tight">AI assistant</div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 12 agents ready
            </div>
          </div>
        </div>
        {!empty && (
          <button onClick={() => setMessages([])} className="btn-ghost !px-2.5 !py-1.5 text-xs" disabled={busy}>
            <Icon name="plus" className="h-3.5 w-3.5" /> New chat
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5">
        {empty ? (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon name="mic" className="h-6 w-6" /></span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">What do you need today?</h2>
            <p className="mt-1 text-sm text-muted">Tap the mic and speak, or type. No forms. The AI agents do the busy work.</p>
            <div className="mt-6 grid w-full gap-2">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="group flex items-center gap-3 rounded-tile border border-line bg-surface px-3.5 py-3 text-left text-sm transition hover:border-primary/50 hover:bg-primary-soft">
                  <Icon name="sparkles" className="h-4 w-4 shrink-0 text-primary" />
                  <span className="flex-1">{s}</span>
                  <Icon name="arrow" className="h-4 w-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((m, i) =>
              m.from === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-on-primary">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3">
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${m.error ? "bg-red-500/12 text-red-600 dark:text-red-400" : "bg-primary-soft text-primary"}`}>
                    <Icon name={m.error ? "info" : "bot"} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 max-w-[92%] flex-1 space-y-2.5">
                    {m.agent && m.agent !== "help" && <div className="text-[11px] font-medium text-muted">{agentName(m.agent)}</div>}
                    <div className={`whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-2.5 text-sm ${
                      m.error ? "border border-red-500/30 bg-red-500/8 text-red-700 dark:text-red-300" : "bg-surface-2"}`}>
                      {m.text}
                    </div>
                    {m.cards?.map((c, j) => <ResultCard key={j} card={c} onAction={(p) => send(p)} />)}
                  </div>
                </div>
              )
            )}
            {busy && (
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary"><Icon name="bot" className="h-3.5 w-3.5" /></span>
                <div className="flex items-center gap-1 rounded-2xl bg-surface-2 px-4 py-3">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                  ))}
                  <span className="ml-2 text-xs text-muted">Agents are working…</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line p-3">
        {hint && (
          <div className="mb-2 flex items-start gap-2 rounded-control bg-primary-soft px-3 py-2 text-xs text-fg">
            <Icon name="mic" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span><b>{listening ? "Listening. " : ""}</b>{hint} <span className="text-muted">(or type it)</span></span>
          </div>
        )}
        <form onSubmit={(e) => { e.preventDefault(); setHint(""); send(input); }} className="flex items-center gap-2">
          <button type="button" onClick={toggleMic} title={listening ? "Stop" : "Speak"} aria-label={listening ? "Stop listening" : "Start voice input"}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition ${
              listening ? "animate-pulse bg-red-500 text-white" : "bg-primary text-on-primary hover:bg-primary-hover"}`}>
            <Icon name={listening ? "stop" : "mic"} className="h-5 w-5" />
          </button>
          {allowUpload && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                title="Upload resume (PDF or photo) from laptop or phone" aria-label="Upload resume"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-50">
                <Icon name="paperclip" className="h-[18px] w-[18px]" />
              </button>
            </>
          )}
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Listening…" : "Speak or type what you need…"}
            className="input h-11 flex-1 !rounded-full !px-4" />
          <button disabled={busy || !input.trim()} aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fg text-bg transition hover:opacity-90 disabled:opacity-30">
            <Icon name="send" className="h-[18px] w-[18px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
