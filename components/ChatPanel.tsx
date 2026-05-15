"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { DailySnapshot } from "@/types/crypto";
import clsx from "clsx";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTED = [
  "Why is #1 ranked so high today?",
  "What's the market regime telling us?",
  "Which pick has the most risk?",
  "Explain the scoring model",
  "What would invalidate #2's signal?",
];

function MarkdownText({ text }: { text: string }) {
  // Minimal markdown: bold, bullet points, line breaks
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        // Bullet points
        if (line.match(/^[-•*]\s/)) {
          const content = line.replace(/^[-•*]\s/, "");
          return (
            <div key={i} className="flex gap-1.5">
              <span className="text-blue-400 flex-shrink-0 mt-0.5">·</span>
              <span dangerouslySetInnerHTML={{ __html: boldify(content) }} />
            </div>
          );
        }
        // Numbered list
        if (line.match(/^\d+\.\s/)) {
          return <div key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />;
        }
        return <div key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />;
      })}
    </div>
  );
}

function boldify(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong class='text-white'>$1</strong>")
    .replace(/`(.+?)`/g, "<code class='bg-[#252d40] px-1 rounded text-blue-300 text-[11px]'>$1</code>");
}

interface Props {
  snapshot: import("@/types/crypto").DailySnapshot | null;
}

export function ChatPanel({ snapshot }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // GSAP panel open animation
  useEffect(() => {
    if (!panelRef.current) return;
    import("gsap").then(({ gsap }) => {
      if (open) {
        gsap.fromTo(panelRef.current,
          { y: 20, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power3.out" }
        );
      }
    });
  }, [open]);

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Placeholder assistant message we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, snapshot }),
      });

      if (!res.ok || !res.body) throw new Error(`API ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: accumulated };
          return updated;
        });
      }
    } catch (err) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: `Sorry, something went wrong: ${String(err)}`,
        };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, messages, snapshot, streaming]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasData = !!snapshot?.top5?.length;

  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "fixed bottom-6 right-4 sm:right-6 z-40 w-14 h-14 rounded-full shadow-2xl",
          "flex items-center justify-center transition-all duration-300",
          "bg-gradient-to-br from-blue-600 to-violet-600 hover:scale-110",
          open && "rotate-90 scale-110"
        )}
        aria-label="Open AI chat"
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 2l14 14M16 2L2 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="9" cy="10" r="1" fill="white"/>
            <circle cx="12" cy="10" r="1" fill="white"/>
            <circle cx="15" cy="10" r="1" fill="white"/>
          </svg>
        )}
      </button>

      {/* Unread dot when there's data but chat hasn't been opened */}
      {!open && hasData && messages.length === 0 && (
        <div className="fixed bottom-[72px] right-4 sm:right-6 z-40 w-3 h-3 rounded-full bg-green-400 ring-2 ring-[#0f1117] animate-pulse" />
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-4 sm:right-6 z-40 w-[calc(100vw-2rem)] sm:w-[380px]
            bg-[#161b27] border border-[#2e3a55] rounded-2xl shadow-2xl shadow-black/60
            flex flex-col overflow-hidden"
          style={{ height: "min(520px, calc(100dvh - 140px))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2535] flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">CryptoPulse AI</div>
              <div className="text-[10px] text-slate-500">
                {hasData
                  ? `Analyzing today's top ${snapshot!.top5.length} signals`
                  : "Load the dashboard first"}
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded hover:bg-[#252d40]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 text-center pt-2">
                  {hasData
                    ? "Ask me anything about today's signals."
                    : "Hit Refresh on the dashboard to load today's data, then ask me anything."}
                </p>
                {hasData && (
                  <div className="space-y-1.5">
                    {SUGGESTED.map((q) => (
                      <button
                        key={q}
                        onClick={() => send(q)}
                        className="w-full text-left text-xs text-slate-400 hover:text-white
                          bg-[#0f1117] hover:bg-[#252d40] border border-[#1e2535] hover:border-blue-500/40
                          rounded-lg px-3 py-2 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  "flex gap-2",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-violet-600
                    flex items-center justify-center flex-shrink-0 mt-0.5 text-white text-[9px] font-bold">
                    AI
                  </div>
                )}
                <div
                  className={clsx(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-[#0f1117] text-slate-300 rounded-tl-sm border border-[#1e2535]"
                  )}
                >
                  {msg.role === "assistant"
                    ? msg.content
                      ? <MarkdownText text={msg.content} />
                      : <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:"0ms"}}/>
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:"150ms"}}/>
                          <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:"300ms"}}/>
                        </span>
                    : msg.content
                  }
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-[#1e2535] p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask about today's signals…"
                rows={1}
                disabled={streaming || !hasData}
                className="flex-1 bg-[#0f1117] border border-[#1e2535] focus:border-blue-500/60
                  rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-600
                  resize-none outline-none transition-colors disabled:opacity-40
                  leading-relaxed"
                style={{ minHeight: "38px", maxHeight: "100px" }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || streaming || !hasData}
                className="flex-shrink-0 w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500
                  disabled:opacity-30 disabled:cursor-not-allowed
                  flex items-center justify-center transition-colors"
              >
                {streaming ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M12 7L2 2l3 5-3 5 10-5z" fill="white"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="text-[9px] text-slate-700 mt-1.5 text-center">
              Not financial advice · Powered by Claude
            </p>
          </div>
        </div>
      )}
    </>
  );
}
