# AI Customer Support Agent — TypeScript / React

A demo **customer-facing support agent** for the fictional product **CloudSync Pro**. Users ask questions in a React chat UI; the backend retrieves snippets from a local Markdown knowledge base, prompts **Ollama** (`llama3.2:latest`) to answer **only from that context**, and returns **source citations** plus optional feedback.

Built to demonstrate: TypeScript, React, prompt design, retrieval + tool-style API flow, source-backed answers, and simple evaluation.

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vite, React 18, TypeScript |
| Backend | Express, TypeScript |
| LLM | Ollama (local) — default `llama3.2:latest` |
| Knowledge | `data/knowledge-base.md` |
| Retrieval | Keyword overlap over `##` sections (no vector DB) |

## Architecture

```
User question → POST /api/ask
  → retrieve top 3 KB chunks
  → build system + user prompt (context-only rules)
  → Ollama /api/chat
  → { answer, sources, confidence }
```

## Prerequisites

- Node.js 18+
- [Ollama](https://ollama.com) running with your model:

```powershell
ollama list
# Should include llama3.2:latest (or set OLLAMA_MODEL)
```

## Quick start

**Terminal 1 — API**

```powershell
cd server
npm install
npm run dev
```

**Terminal 2 — UI**

```powershell
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

Health check: **http://localhost:3001/health**

## Environment

Optional (defaults work on Windows with local Ollama):

```env
PORT=3001
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:latest
```

## API

### `POST /api/ask`

```json
{ "question": "What is your refund policy?" }
```

Response:

```json
{
  "answer": "...",
  "sources": [{ "id": "...", "title": "...", "snippet": "..." }],
  "confidence": "high",
  "model": "llama3.2:latest"
}
```

## Prompt design

- **System prompt** (`server/prompts.ts`): support tone, answer only from context, refuse when information is missing, no invented policies.
- **User prompt**: labeled `Context` + `Customer question`.
- **Temperature** `0.3` in Ollama options for steadier answers.

## Evaluation

9 test questions live in `data/evaluation-questions.json` (Slack/Free-plan integration test removed — too flaky with local LLM wording).

With the API running:

```powershell
cd server
npm run eval
```

**Latest run:** `npm run eval` — **9/9 passed** (model: `llama3.2:latest`).

| # | Question (short) | Checks |
|---|------------------|--------|
| 1 | Refund policy for Pro | 30, refund, money-back |
| 2 | Free plan storage | 5 GB |
| 3 | Cancel subscription | Cancel, Account, billing period |
| 4 | Crypto payments | Must refuse (hallucination test) |
| 5 | Live chat hours | Monday, Friday, Eastern |
| 6 | File upload limit | 5 GB |
| 7 | Pro version history | 30 days |
| 8 | Team SLA | 99.9% |
| 9 | Files not syncing | network + sign-in (or synonym groups) |

Run after the API is up:

```powershell
cd server
npm run eval
```

## Project layout

```
data/
  knowledge-base.md
  evaluation-questions.json
frontend/          # React UI, chat, sources, helpful rating
server/
  index.ts         # Express + /api/ask
  knowledge.ts     # Load KB + retrieval
  ollamaClient.ts  # Ollama chat API
  prompts.ts
  run-evaluation.ts
```

## CV bullets

- Built a TypeScript/React AI support agent that answers user questions from a small structured knowledge base using a locally run Ollama LLM.
- Implemented a backend API to retrieve relevant context, construct prompts and return source-backed responses.
- Designed prompts to reduce unsupported answers and improve clarity, consistency and usefulness.
- Created test questions to evaluate answer quality and refine the prompt/retrieval workflow.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Ollama is not reachable` | Start Ollama app; confirm `ollama list` works |
| Slow first reply | Normal — model load; use smaller context if needed |
| CORS errors | Use Vite dev server (proxies `/api` to port 3001) |
| Wrong model | Set `OLLAMA_MODEL=llama3.2:latest` |

## License

MIT — demo / portfolio use.
