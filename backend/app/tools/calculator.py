"""Safe arithmetic for assistant tool use."""

from __future__ import annotations

import ast
import operator
import re

_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

_CALC_HINT = re.compile(
    r"("
    r"\b(?:calculate|compute|what(?:'?s| is)|whats)\b.{0,40}[\d\(]|"
    r"\b\d[\d\.\s]*[\+\-\*/×÷%]"
    r"|%\s*of\s*"
    r")",
    re.I,
)

_PERCENT_OF = re.compile(
    r"(?P<a>\d+(?:\.\d+)?)\s*%\s*of\s*(?P<b>\d+(?:\.\d+)?)",
    re.I,
)

_EXPR = re.compile(r"(?P<expr>[\d\.\s\+\-\*/\(\)%]+)")


def wants_calculation(text: str) -> bool:
    return bool(_CALC_HINT.search(text or ""))


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return float(_OPS[type(node.op)](_eval_node(node.operand)))
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        return float(_OPS[type(node.op)](left, right))
    raise ValueError("Unsupported expression")


def safe_calculate(expression: str) -> float:
    tree = ast.parse(expression, mode="eval")
    for node in ast.walk(tree):
        if isinstance(node, (ast.Call, ast.Attribute, ast.Name, ast.Subscript)):
            raise ValueError("Unsupported expression")
    return _eval_node(tree)


def try_calculate(message: str) -> tuple[str, float] | None:
    """Return (display_expression, result) if a calc is detected."""
    text = message.strip()
    m = _PERCENT_OF.search(text)
    if m:
        a = float(m.group("a"))
        b = float(m.group("b"))
        return f"{a}% of {b}", (a / 100.0) * b

    if not wants_calculation(text):
        return None

    candidates = _EXPR.findall(text.replace("×", "*").replace("÷", "/"))
    best = None
    for raw in candidates:
        expr = re.sub(r"\s+", "", raw.strip())
        if len(expr) < 3 or not re.search(r"[\+\-\*/]", expr):
            continue
        try:
            result = safe_calculate(expr)
            best = (expr, result)
        except Exception:
            continue
    return best
