"""Analyse setup and deployment logs with an optional OpenAI-backed assistant."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai_assistant.analysis import analyse_setup_log_file


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Analyse a setup/deployment log and return an advisory summary, "
            "likely cause, suggested fix, commands to try, and severity."
        )
    )
    parser.add_argument("log_path", help="Path to the log file to analyse")
    parser.add_argument(
        "--model",
        default=None,
        help="Override OPENAI_MODEL for this run",
    )
    parser.add_argument(
        "--max-lines",
        type=int,
        default=200,
        help="Maximum number of extracted log lines sent to the model (default: 200)",
    )
    parser.add_argument(
        "--show-excerpt",
        action="store_true",
        help="Print the extracted log excerpt before the AI analysis",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return analyse_setup_log_file(
        args.log_path,
        model=args.model,
        max_lines=args.max_lines,
        show_excerpt=args.show_excerpt,
    )


if __name__ == "__main__":
    raise SystemExit(main())
