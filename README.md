# LangChain 代理式 AI 實戰工作坊：實作程式 Starter Pack

這份範例程式對應 18 小時課程，重點放在 LangChain v1 `create_agent`、Middleware、Structured Output、MCP、Streamlit 介面，以及 Claude Code / Codex 協作開發規範。

## 1. 安裝

建議使用 Python 3.10 以上。

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

請在 `.env` 設定至少一組模型 API Key，例如 OpenAI 或 Anthropic。

```bash
OPENAI_API_KEY=你的金鑰
# ANTHROPIC_API_KEY=你的金鑰
MODEL_NAME=openai:gpt-5.4-mini
# MODEL_NAME=claude-sonnet-4-6
```

## 2. 執行順序

```bash
python src/01_basic_agent.py
python src/02_middleware_agent.py
python src/03_structured_output_weather.py
python src/04_mcp_agent.py
streamlit run src/05_streamlit_app.py
```

## 3. 給 Claude Code / Codex 的專案規範

- `CLAUDE.md`：給 Claude Code 讀取的專案背景與開發規則。
- `AGENTS.md`：給 Codex 讀取的專案背景、測試方式與 Review guidelines。
- `.github/codex/prompts/review.md`：可搭配 Codex GitHub Action 的 PR review prompt。

## 4. 教學提醒

範例以教學清楚為主，實務上請補上：

- API Key 與祕密資訊管理
- Tool 權限控管與稽核紀錄
- LangSmith tracing / evaluation
- 單元測試與整合測試
- Human-in-the-loop 的狀態恢復與權限流程
