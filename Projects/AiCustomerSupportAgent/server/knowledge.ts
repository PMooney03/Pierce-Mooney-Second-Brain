import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const KB_PATH = join(__dirname, "..", "data", "knowledge-base.md");

let cachedChunks: KnowledgeChunk[] | null = null;

export function loadKnowledgeBase(): KnowledgeChunk[] {
  if (cachedChunks) return cachedChunks;

  const raw = readFileSync(KB_PATH, "utf-8");
  const sections = raw.split(/^## /m).filter((s) => s.trim());

  cachedChunks = sections.map((section, index) => {
    const [titleLine, ...bodyLines] = section.trim().split("\n");
    const title = titleLine.replace(/^#+\s*/, "").trim();
    const content = bodyLines.join("\n").trim();
    return {
      id: `chunk-${index}`,
      title,
      content,
    };
  });

  return cachedChunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/** Match singular/plural and simple verb forms (e.g. integration ↔ integrations, syncing ↔ sync). */
function tokenMatchesText(text: string, token: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes(token)) return true;
  if (!token.endsWith("s") && lower.includes(`${token}s`)) return true;
  if (token.endsWith("s") && token.length > 4 && lower.includes(token.slice(0, -1)))
    return true;
  if (token.endsWith("ing") && token.length > 5) {
    const stem = token.slice(0, -3);
    if (lower.includes(stem)) return true;
  }
  return false;
}

export function retrieveRelevantChunks(
  question: string,
  topK = 3
): KnowledgeChunk[] {
  const chunks = loadKnowledgeBase();
  const questionTokens = tokenize(question);

  // Common plan words appear in many sections; de-emphasize so specific terms (slack, sync) win.
  const generic = new Set([
    "free",
    "plan",
    "pro",
    "team",
    "account",
    "users",
    "use",
    "can",
    "the",
    "and",
    "for",
  ]);

  const scored = chunks.map((chunk) => {
    const text = `${chunk.title} ${chunk.content}`;
    let score = 0;
    for (const q of questionTokens) {
      const weight = generic.has(q) ? 1 : 3;
      if (tokenMatchesText(text, q)) score += weight;
      if (tokenMatchesText(chunk.title, q)) score += weight + 2;
    }
    return { chunk, score };
  });

  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return [];

  const best = ranked[0].score;
  return ranked
    .filter((s) => s.score >= best * 0.6)
    .slice(0, topK)
    .map((s) => s.chunk);
}

export function formatContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return "(No matching documentation found.)";
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.title}]\n${c.content}`
    )
    .join("\n\n---\n\n");
}
