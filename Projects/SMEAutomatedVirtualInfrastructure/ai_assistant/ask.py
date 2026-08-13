"""Documentation Q&A support agent (retrieve + Ollama/OpenAI answer)."""

from __future__ import annotations

from pathlib import Path

from ai_assistant.analysis import check_api_key_configured
from ai_assistant.common import AIAnalysisError, DEFAULT_MODEL, call_openai_text, load_prompt_file
from ai_assistant.knowledge import (
    build_context_block,
    format_sources,
    search_documentation,
)

FALLBACK_NOTE = (
    "Note: No strong match in project docs — answer may be general. "
    "Verify against README.md and docs/ before acting."
)


def ask_documentation(
    question: str,
    *,
    project_root: Path,
    model: str | None = None,
    top_k: int = 5,
) -> int:
    """Answer a question using project documentation retrieval + LLM."""
    key_error = check_api_key_configured()
    if key_error:
        print(f"[!] {key_error}")
        return 1

    question = question.strip()
    if not question:
        print("[!] Question cannot be empty.")
        return 1

    chunks = search_documentation(project_root, question, top_k=top_k)
    context = build_context_block(chunks, project_root=project_root)

    template = load_prompt_file("documentation_qa.txt")
    prompt = (
        template.replace("{{QUESTION}}", question).replace("{{CONTEXT}}", context)
    )

    system = (
        "You are a helpful SME infrastructure support agent. "
        "Ground answers in the provided snippets. Be honest when information is missing."
    )

    try:
        answer = call_openai_text(
            prompt,
            system_content=system,
            model=model or DEFAULT_MODEL,
        )
    except AIAnalysisError as exc:
        print(f"[!] AI request failed: {exc}")
        return 1

    print("SME Infrastructure AI Support Agent")
    print("=" * 36)
    print()
    print(f"Question: {question}")
    print()
    if not chunks:
        print(f"[!] {FALLBACK_NOTE}")
        print()
    print("Answer:")
    print(answer.strip())
    print()
    print(format_sources(chunks, project_root=project_root))
    print()
    print(
        "Advisory only. For live failures, also run: python cli.py ai-log --latest"
    )
    return 0


def ask_interactive(*, project_root: Path, model: str | None = None) -> int:
    print("SME Infrastructure AI Support Agent (interactive)")
    print("Type a question, or 'quit' to exit.")
    print()
    while True:
        try:
            question = input("Question> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            return 0
        if not question:
            continue
        if question.lower() in {"quit", "exit", "q"}:
            return 0
        print()
        code = ask_documentation(question, project_root=project_root, model=model)
        print()
        if code != 0:
            return code


def main() -> int:
    """Console entry point: interactive documentation Q&A."""
    return ask_interactive(project_root=Path(__file__).resolve().parent.parent)
