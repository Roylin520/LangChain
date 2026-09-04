"""Day 3 Lab: Structured Output + 真實開放資料 API。

目標：
1. 讓 agent 呼叫「真的會連外網」的工具：中央氣象署 CWA Open Data。
2. 使用 Pydantic schema 定義可驗證輸出，agent 最終回傳 structured_response。
3. 說明為什麼企業系統不應只解析自然語言文字。

執行：
    python src/03_structured_output_weather.py              # 預設查臺北市
    python src/03_structured_output_weather.py 臺中市        # 指定縣市
    python src/03_structured_output_weather.py 高雄市 --api-only   # 只測 API，不呼叫模型

前置作業：在 .env 設定 CWA_API_KEY（免費，見 src/cwa_weather.py 說明）。
"""

from __future__ import annotations

import json
import os
import sys

from dotenv import load_dotenv
from langchain.agents import create_agent
from pydantic import BaseModel, Field

from cwa_weather import CWAWeatherError, fetch_city_weather, format_report_for_llm

load_dotenv()

# 預設走本地 Ollama（免 API Key）。Structured output 對本地模型會退回
# ToolStrategy（用 tool calling 產生 schema 欄位），所以模型必須支援 tools。
MODEL_NAME = os.getenv("MODEL_NAME", "ollama:gemma4:31b-cloud")


class WeatherAnswer(BaseModel):
    """Agent 最終要輸出的結構化結果。

    這層 schema 是「合約」：欄位型別與範圍由 Pydantic 驗證，
    下游系統（推播、報表、Line Bot）可以直接取欄位，不必再用正規表示式拆句子。
    """

    location: str = Field(description="查詢地點，使用氣象署的正式縣市名稱")
    period: str = Field(description="這份回答對應的預報時段，例如 今晚到明晨")
    summary: str = Field(description="天氣摘要，一到兩句")
    min_temp_c: int | None = Field(default=None, description="該時段最低溫（攝氏）")
    max_temp_c: int | None = Field(default=None, description="該時段最高溫（攝氏）")
    pop_percent: int | None = Field(
        default=None, ge=0, le=100, description="該時段降雨機率（%）"
    )
    suggested_action: str = Field(description="使用者可以採取的建議")
    confidence: float = Field(ge=0, le=1, description="回答信心分數，0 到 1")


def get_weather(city: str) -> str:
    """Get the official 36-hour weather forecast for a Taiwan city from the CWA Open Data API.

    Args:
        city: 台灣縣市名稱，例如「臺北市」「台中」「高雄市」。
    """
    # 工具內部把例外轉成文字回傳，模型才能看到失敗原因並回覆使用者；
    # 直接讓例外往外拋會中斷整個 agent 迴圈。
    try:
        report = fetch_city_weather(city)
    except CWAWeatherError as error:
        return f"查詢失敗：{error}"
    return format_report_for_llm(report)


agent = create_agent(
    model=MODEL_NAME,
    tools=[get_weather],
    response_format=WeatherAnswer,
    system_prompt=(
        "你是天氣查詢助理，資料來源是台灣中央氣象署開放資料。"
        "請務必先用 get_weather 工具取得資料，不可以自行編造溫度或降雨機率。"
        "若工具回傳查詢失敗，請如實說明並把 confidence 設低。"
        "最後輸出符合 schema 的結構化結果，數值欄位要直接取自工具資料。"
    ),
)


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    city = args[0] if args else "臺北市"
    api_only = "--api-only" in sys.argv

    if api_only:
        # 教學用：先確認 API 串接與解析正確，再往上疊 LLM，出錯時比較容易定位。
        try:
            report = fetch_city_weather(city)
        except CWAWeatherError as error:
            print(f"查詢失敗：{error}")
            return 1
        print(json.dumps(report.model_dump(), ensure_ascii=False, indent=2))
        return 0

    question = f"今天{city}適合騎腳踏車嗎？請說明理由。"
    result = agent.invoke({"messages": [{"role": "user", "content": question}]})

    print("自然語言回覆：")
    print(result["messages"][-1].content)

    print("\n結構化資料：")
    answer = result.get("structured_response")
    if isinstance(answer, WeatherAnswer):
        # 已通過 Pydantic 驗證，可以安全地當成物件使用。
        print(json.dumps(answer.model_dump(), ensure_ascii=False, indent=2))
        return 0

    # structured_response 是 None，代表模型沒有呼叫 structured output 工具。
    # 這正是本堂課要示範的重點：小模型常常「把 JSON 當文字印出來」，
    # 看起來很像結構化結果，但下游程式拿到的是 None，任何欄位存取都會炸掉。
    print(f"（None）模型未產生結構化輸出，實際型別：{type(answer).__name__}")
    print(
        f"目前模型：{MODEL_NAME}\n"
        "常見原因：模型太小或 tool calling 不穩定，於是把 JSON 直接寫進文字回覆。\n"
        "請改用支援 tool calling 且能力足夠的模型，例如："
        "MODEL_NAME=ollama:gemma4:31b-cloud 或雲端 API 模型。"
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
