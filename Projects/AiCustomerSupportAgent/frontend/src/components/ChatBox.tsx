import { useEffect, useRef, useState } from "react";
import type { AskResponse, ChatMessage } from "../types";
import SourceList from "./SourceList";
import "./ChatBox.css";

const SUGGESTIONS = [
  "What is your refund policy for Pro?",
  "How do I cancel my subscription?",
  "What storage does the Free plan include?",
];

function loadRatings(): Record<string, "yes" | "no"> {
  try {
    const raw = localStorage.getItem("support-ratings");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveRating(messageId: string, rating: "yes" | "no") {
  const all = loadRatings();
  all[messageId] = rating;
  localStorage.setItem("support-ratings", JSON.stringify(all));
}

export default function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm the CloudSync Pro support assistant. Ask me anything about billing, plans, sync, or security — I'll answer from our documentation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const body = data as AskResponse;
      const ratings = loadRatings();
      const assistantId = `assistant-${Date.now()}`;

      setMessages((m) => [
        ...m,
        {
          id: assistantId,
          role: "assistant",
          content: body.answer,
          sources: body.sources,
          confidence: body.confidence,
          rating: ratings[assistantId] ?? null,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function rate(messageId: string, rating: "yes" | "no") {
    saveRating(messageId, rating);
    setMessages((m) =>
      m.map((msg) => (msg.id === messageId ? { ...msg, rating } : msg))
    );
  }

  return (
    <div className="chat">
      <div className="messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message message--${msg.role}`}
          >
            <div className="bubble">
              <p className="bubble-text">{msg.content}</p>
              {msg.role === "assistant" && msg.sources && (
                <SourceList sources={msg.sources} />
              )}
              {msg.role === "assistant" && msg.id !== "welcome" && (
                <div className="feedback">
                  <span>Was this helpful?</span>
                  <button
                    type="button"
                    className={`feedback-btn ${msg.rating === "yes" ? "active" : ""}`}
                    onClick={() => rate(msg.id, "yes")}
                    disabled={msg.rating != null}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`feedback-btn ${msg.rating === "no" ? "active" : ""}`}
                    onClick={() => rate(msg.id, "no")}
                    disabled={msg.rating != null}
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message message--assistant">
            <div className="bubble bubble--loading">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="error-banner">{error}</p>}

      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="suggestion-chip"
            onClick={() => ask(s)}
            disabled={loading}
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="input-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a support question…"
          disabled={loading}
          aria-label="Your question"
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
