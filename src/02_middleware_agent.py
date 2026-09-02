"""Day 2 Lab: Middleware、PII 保護與 Retry。

目標：
1. 用 PIIMiddleware 遮蔽 email / credit card。
2. 用 ModelRetryMiddleware 增加模型呼叫穩定性。
3. 示範 Middleware 是 agent loop 中的生命週期控制層。
"""

from __future__ import annotations

import os
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware, PIIMiddleware, SummarizationMiddleware

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "openai:gpt-5.4-mini")
SUMMARY_MODEL_NAME = os.getenv("SUMMARY_MODEL_NAME", MODEL_NAME)


def crm_lookup(customer_name: str) -> str:
    """Look up a fake CRM record by customer name."""
    return f"{customer_name} 是 VIP 客戶，偏好以 email 收到報價，但不可在回覆中揭露個資。"


agent = create_agent(
    model=MODEL_NAME,
    tools=[crm_lookup],
    middleware=[
        PIIMiddleware("email", strategy="redact", apply_to_input=True),
        PIIMiddleware("credit_card", strategy="mask", apply_to_input=True),
        SummarizationMiddleware(
            model=SUMMARY_MODEL_NAME,
            trigger=("messages", 6),
            keep=("messages", 4),
        ),
        ModelRetryMiddleware(max_retries=2, on_failure="continue"),
    ],
    system_prompt="你是企業客服 Agent，必須保護個資並保持回覆簡潔。",
)

if __name__ == "__main__":
    result = agent.invoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "我是王小明，email 是 wang@example.com，信用卡 4111-1111-1111-1111。請查 CRM 後回覆。",
                }
            ]
        }
    )
    print(result["messages"][-1].content)
