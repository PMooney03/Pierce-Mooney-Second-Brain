import cors from "cors";
import express from "express";
import {
  formatContext,
  retrieveRelevantChunks,
  type KnowledgeChunk,
} from "./knowledge.js";
import { checkOllamaHealth, generateAnswer, getModelName } from "./ollamaClient.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));
app.use(express.json());

function toSources(chunks: KnowledgeChunk[]) {
  return chunks.map((c) => ({
    id: c.id,
    title: c.title,
    snippet:
      c.content.length > 220 ? `${c.content.slice(0, 220)}…` : c.content,
  }));
}

app.get("/health", async (_req, res) => {
  const ollamaOk = await checkOllamaHealth();
  res.json({
    status: ollamaOk ? "ok" : "degraded",
    ollama: ollamaOk,
    model: getModelName(),
  });
});

app.post("/api/ask", async (req, res) => {
  const question =
    typeof req.body?.question === "string" ? req.body.question.trim() : "";

  if (!question) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  const ollamaOk = await checkOllamaHealth();
  if (!ollamaOk) {
    res.status(503).json({
      error:
        "Ollama is not reachable. Start Ollama and ensure the model is pulled.",
    });
    return;
  }

  try {
    const chunks = retrieveRelevantChunks(question, 3);
    const context = formatContext(chunks);
    const userPrompt = buildUserPrompt(context, question);
    const answer = await generateAnswer(SYSTEM_PROMPT, userPrompt);

    res.json({
      answer,
      sources: toSources(chunks),
      confidence: chunks.length > 0 ? "high" : "low",
      model: getModelName(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to generate answer",
    });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  console.log(`Model: ${getModelName()}`);
});
