"""Day 1 Lab: 最小可用 LangChain Agent。

目標：
1. 使用 create_agent 建立 agent harness。
2. 設計一個安全計算工具。
3. 觀察模型如何決定是否呼叫工具。
"""

from __future__ import annotations

import ast
import operator
import os
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "openai:gpt-5.4-mini")

_ALLOWED_BIN_OPS: dict[type[ast.operator], Any] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
}

_ALLOWED_UNARY_OPS: dict[type[ast.unaryop], Any] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BIN_OPS:
        return _ALLOWED_BIN_OPS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARY_OPS:
        return _ALLOWED_UNARY_OPS[type(node.op)](_eval_node(node.operand))
    raise ValueError("Only simple arithmetic expressions are allowed.")


def safe_calculate(expression: str) -> str:
    """Calculate a simple arithmetic expression, such as '3 * (5 + 2)'."""
    try:
        parsed = ast.parse(expression, mode="eval")
        return str(_eval_node(parsed))
    except Exception as exc:  # 教學範例：實務上應記錄錯誤類型
        return f"計算失敗：{exc}"


agent = create_agent(
    model=MODEL_NAME,
    tools=[safe_calculate],
    system_prompt=(
        "你是一位嚴謹的繁體中文 AI 助教。"
        "遇到數學計算時請使用 safe_calculate 工具，不要心算。"
    ),
)

if __name__ == "__main__":
    result = agent.invoke(
        {"messages": [{"role": "user", "content": "請計算 18 * (23 + 7)，並用一句話說明。"}]}
    )
    print(result["messages"][-1].content)
