import { useEffect, useState } from "react";
import ChatBox from "./components/ChatBox";
import "./App.css";

export default function App() {
  const [health, setHealth] = useState<{
    ollama: boolean;
    model?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then((d) => setHealth({ ollama: d.ollama, model: d.model }))
      .catch(() => setHealth({ ollama: false }));
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>CloudSync Pro</h1>
          <p className="subtitle">AI Customer Support Agent</p>
        </div>
        <div className="status">
          <span
            className={`status-dot ${health?.ollama ? "ok" : "warn"}`}
            title={health?.ollama ? "Ollama connected" : "Ollama unavailable"}
          />
          <span className="status-text">
            {health == null
              ? "Checking…"
              : health.ollama
                ? `Ollama · ${health.model ?? "llama3.2"}`
                : "Start Ollama + API server"}
          </span>
        </div>
      </header>
      <main className="main">
        <ChatBox />
      </main>
      <footer className="footer">
        Answers use only the local knowledge base · Powered by Ollama
      </footer>
    </div>
  );
}
