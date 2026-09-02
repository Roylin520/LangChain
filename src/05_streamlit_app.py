"""Final Project: Streamlit Agent UI。

執行：
streamlit run src/05_streamlit_app.py
"""

from __future__ import annotations

import os
from dotenv import load_dotenv
import streamlit as st
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware, PIIMiddleware

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "openai:gpt-5.4-mini")


def ticket_status(ticket_id: str) -> str:
    """Look up a fake support ticket status by ticket ID."""
    return f"Ticket {ticket_id}: 目前狀態為處理中，預計 1 個工作天內更新。"


@st.cache_resource
def build_agent():
    return create_agent(
        model=MODEL_NAME,
        tools=[ticket_status],
        middleware=[
            PIIMiddleware("email", strategy="redact", apply_to_input=True),
            ModelRetryMiddleware(max_retries=2, on_failure="continue"),
        ],
        system_prompt="你是企業內部 IT 服務台 Agent。回答請使用繁體中文，必要時呼叫工具。",
    )


st.set_page_config(page_title="LangChain Agent Workshop", page_icon="🤖")
st.title("LangChain 代理式 AI 實戰工作坊")
st.caption("Final Project：具備工具呼叫與基礎個資保護的客服 Agent")

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.write(msg["content"])

user_input = st.chat_input("例如：我的 email 是 a@example.com，請查 ticket T-1001")

if user_input:
    st.session_state.messages.append({"role": "user", "content": user_input})
    with st.chat_message("user"):
        st.write(user_input)

    agent = build_agent()
    result = agent.invoke({"messages": st.session_state.messages})
    answer = result["messages"][-1].content

    st.session_state.messages.append({"role": "assistant", "content": answer})
    with st.chat_message("assistant"):
        st.write(answer)
