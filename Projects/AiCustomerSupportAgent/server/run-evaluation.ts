import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_PATH = join(__dirname, "..", "data", "evaluation-questions.json");
const API = process.env.API_URL ?? "http://localhost:3001";

interface EvalQuestion {
  id: number;
  question: string;
  /** Only question #4 uses "refusal" (must not answer from thin air). */
  evalType?: "refusal" | "content";
  expectedContains: string[];
  /** Pass if any group matches (all terms in that group). */
  expectedContainsAny?: string[][];
  notes: string;
}

function checkContains(answer: string, terms: string[]): boolean {
  const lower = answer.toLowerCase();
  return terms.every((t) => lower.includes(t.toLowerCase()));
}

function checkQuestion(answer: string, q: EvalQuestion): boolean {
  if (isRefusal(answer)) return false;

  const anyMatch =
    q.expectedContainsAny?.some((group) => checkContains(answer, group)) ??
    false;
  const primaryMatch =
    q.expectedContains.length > 0 &&
    checkContains(answer, q.expectedContains);

  return anyMatch || primaryMatch;
}

function isRefusal(answer: string): boolean {
  const lower = answer.toLowerCase();
  return (
    lower.includes("don't have enough") ||
    lower.includes("do not have enough") ||
    lower.includes("not in our documentation") ||
    lower.includes("contact support")
  );
}

async function main() {
  const questions: EvalQuestion[] = JSON.parse(
    readFileSync(EVAL_PATH, "utf-8")
  );

  console.log(`Running ${questions.length} evaluation questions against ${API}\n`);

  let passed = 0;
  const results: { id: number; pass: boolean; detail: string }[] = [];

  for (const q of questions) {
    const res = await fetch(`${API}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q.question }),
    });

    if (!res.ok) {
      results.push({
        id: q.id,
        pass: false,
        detail: `HTTP ${res.status}`,
      });
      continue;
    }

    const data = (await res.json()) as { answer: string };
    const answer = data.answer ?? "";

    let pass: boolean;
    let detail: string;

    const isRefusalTest = q.evalType === "refusal";

    if (isRefusalTest) {
      pass = isRefusal(answer);
      detail = pass
        ? "Correctly refused or cited missing info"
        : `Should refuse; got: ${answer.slice(0, 120)}…`;
    } else {
      pass = checkQuestion(answer, q);
      const label = q.expectedContainsAny?.length
        ? q.expectedContainsAny.map((g) => g.join(" + ")).join(" | ")
        : q.expectedContains.join(", ");
      detail = pass
        ? `Matched: ${label}`
        : `Missing terms: ${label}`;
    }

    if (pass) passed++;
    results.push({ id: q.id, pass, detail });
    console.log(
      `${pass ? "PASS" : "FAIL"} #${q.id}: ${q.question.slice(0, 50)}… — ${detail}`
    );
  }

  console.log(`\n${passed}/${questions.length} passed`);
  console.log("\nUpdate README Evaluation section with these results.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
