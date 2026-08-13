"""Analyse monitoring alert payloads with an optional OpenAI-backed assistant."""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai_assistant.analysis import analyse_alert_file


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Analyse a Prometheus or monitoring alert payload and return an advisory "
            "summary, likely cause, suggested fix, commands to try, and severity."
        )
    )
    parser.add_argument("alert_path", help="Path to the alert JSON file to analyse")
    parser.add_argument(
        "--model",
        default=None,
        help="Override OPENAI_MODEL for this run",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    return analyse_alert_file(args.alert_path, model=args.model)


if __name__ == "__main__":
    raise SystemExit(main())
