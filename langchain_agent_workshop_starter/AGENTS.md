# AGENTS.md

## Project overview

This is a LangChain v1 agent workshop starter project. The course teaches `create_agent`, middleware, structured output, MCP tools, Streamlit UI, and comparison with Claude Code and Codex.

## How to run

```bash
pip install -r requirements.txt
cp .env.example .env
python src/01_basic_agent.py
python src/02_middleware_agent.py
python src/03_structured_output_weather.py
python src/04_mcp_agent.py
streamlit run src/05_streamlit_app.py
```

## Engineering conventions

- Do not commit secrets.
- Keep examples short and readable for students with basic Python background.
- Use Traditional Chinese (Taiwan) for comments and teaching text when appropriate.
- Prefer LangChain v1 APIs from `langchain.agents`.
- If changing model names, make them configurable through `.env`.

## Review guidelines

- Treat leaked API keys or PII as P1 issues.
- Flag examples that use unsafe `eval` or shell execution without explanation.
- Verify that new code has clear run instructions.
- Verify that code does not require paid services without mentioning the requirement.
