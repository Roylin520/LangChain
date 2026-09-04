"""Day 3 Lab: LangChain Agent 使用 MCP 工具。

目標：
1. 建立本機 MCP server。
2. 用 langchain-mcp-adapters 載入 MCP tools。
3. 說明 MCP 如何讓 Claude Code、Codex、LangChain 共用工具生態。
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

load_dotenv()

# 預設走本地 Ollama（免 API Key），可在 .env 用 MODEL_NAME 覆寫成雲端模型。
MODEL_NAME = os.getenv("MODEL_NAME", "ollama:nemotron-3-nano:4b")
SERVER_PATH = Path(__file__).with_name("mcp_math_server.py")


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": sys.executable,
                "args": [str(SERVER_PATH)],
            }
        }
    )

    tools = await client.get_tools()
    agent = create_agent(
        model=MODEL_NAME,
        tools=tools,
        system_prompt="你是數學助教。計算必須使用 MCP math tools。",
    )
    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "請用工具計算 (3 + 5) / 12，並說明工具呼叫邏輯。"}]}
    )
    print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
