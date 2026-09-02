"""Day 3 Lab: Structured Output。

目標：
1. 使用 Pydantic schema 定義可驗證輸出。
2. 讓 agent 最終回傳 structured_response。
3. 說明為什麼企業系統不應只解析自然語言文字。
"""

from __future__ import annotations

import os
from dotenv import load_dotenv
from langchain.agents import create_agent
from pydantic import BaseModel, Field

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "openai:gpt-5.4-mini")


class WeatherAnswer(BaseModel):
    location: str = Field(description="查詢地點")
    summary: str = Field(description="天氣摘要")
    suggested_action: str = Field(description="使用者可以採取的建議")
    confidence: float = Field(ge=0, le=1, description="回答信心分數，0 到 1")


def get_weather(city: str) -> str:
    """Get mock weather for a city. This is a teaching stub, not real weather data."""
    fake_data = {
        "台北": "陰天，28°C，降雨機率 60%",
        "台中": "晴時多雲，31°C，降雨機率 20%",
        "高雄": "晴朗，32°C，降雨機率 10%",
    }
    return fake_data.get(city, f"{city}：目前沒有即時資料，請提醒使用者查官方天氣來源。")


agent = create_agent(
    model=MODEL_NAME,
    tools=[get_weather],
    response_format=WeatherAnswer,
    system_prompt="你是天氣查詢助理。請使用工具取得資料，最後輸出符合 schema 的結構化結果。",
)

if __name__ == "__main__":
    result = agent.invoke({"messages": [{"role": "user", "content": "今天台北適合騎腳踏車嗎？"}]})
    print("自然語言回覆：")
    print(result["messages"][-1].content)
    print("\n結構化資料：")
    print(result.get("structured_response"))
