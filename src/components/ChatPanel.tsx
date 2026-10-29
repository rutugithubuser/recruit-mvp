"use client";
// The main interface: speak or type. Agents do the rest.
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AgentResult, Card, ChatTurn } from "@/lib/agents/types";
import ResultCard from "./ResultCard";

type Msg = { from: "user" | "agent"; text: string; cards?: Card[]; agent?: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ChatPanel({
  suggestions,
  onResult,
  allowUpload = false,
}: {
  suggestions: string[];
  onResult?: (r: AgentResult) => void;
  allowUpload?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { from: "agent", text: "Hi! Tap the mic and speak, or type what you need." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesRef = useRef<Msg[]>(messages);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function uploadFile(file: File) {
    if (busy) return;
    setMessages((m) => [...m, { from: "user", text: `📎 ${file.name}` }]);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("message", input.trim() || "Here is my resume");
      setInput("");
      const res = await apiFetch("/api/resume/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const result = data as AgentResult;
      setMessages((m) => [...m, { from: "agent", text: result.reply, cards: result.cards, agent: result.agent }]);
      onResult?.(result);
    } catch (e) {
      setMessages((m) => [...m, { from: "agent", text: "⚠️ " + (e as Error).message }]);
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
      const result = data as AgentResult;
      setMessages((m) => [...m, { from: "agent", text: result.reply, cards: result.cards, agent: result.agent }]);
      onResult?.(result);
    } catch (e) {
      setMessages((m) => [...m, { from: "agent", text: "⚠️ " + (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Voice input needs Chrome or Edge. You can type instead.");
      return;
    }
    if (listening) {
      recRef.current?.stop();
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
      if (finalText.trim()) send(finalText, "voice");
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] space-y-2 ${m.from === "user" ? "items-end" : ""}`}>
              <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.from === "user" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                {m.text}
              </div>
              {m.agent && m.agent !== "help" && (
                <div className="text-[11px] text-gray-400 pl-2">handled by {m.agent} agent</div>
              )}
              {m.cards?.map((c, j) => <ResultCard key={j} card={c} onAction={(p) => send(p)} />)}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-gray-400 pl-2 animate-pulse">Agents are working…</div>}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 text-left">
              {s}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-gray-200 p-3 flex gap-2">
        <button type="button" onClick={toggleMic} title="Speak"
          className={`shrink-0 h-11 w-11 rounded-full flex items-center justify-center text-lg ${
            listening ? "bg-red-500 text-white animate-pulse" : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"}`}>
          {listening ? "■" : "🎤"}
        </button>
        {allowUpload && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
            <button type="button" onClick={() => fileRef.current?.click()} title="Upload resume from laptop or phone"
              className="shrink-0 h-11 w-11 rounded-full flex items-center justify-center text-lg bg-gray-100 hover:bg-gray-200">
              📎
            </button>
          </>
        )}
        <input value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Listening…" : "Speak or type what you need…"}
          className="flex-1 rounded-full border border-gray-300 px-4 text-sm outline-none focus:border-indigo-500" />
        <button disabled={busy || !input.trim()}
          className="shrink-0 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50">
          Send
        </button>
      </form>
    </div>
  );
}
