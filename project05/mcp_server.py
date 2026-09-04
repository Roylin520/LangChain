"""Day 3 MCP stdio server exposing the helpdesk Ticket Tool."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from ticket_tool import TicketTool, VALID_PRIORITIES, VALID_STATUSES, masked_ticket


TOOLS = [
    {
        "name": "ticket_create",
        "description": "建立 IT helpdesk 工單",
        "inputSchema": {
            "type": "object",
            "required": ["title", "description", "requester"],
            "properties": {
                "title": {"type": "string"},
                "description": {"type": "string"},
                "requester": {"type": "string"},
                "priority": {"type": "string", "enum": list(VALID_PRIORITIES)},
            },
        },
    },
    {
        "name": "ticket_list",
        "description": "列出 IT helpdesk 工單",
        "inputSchema": {
            "type": "object",
            "properties": {"status": {"type": "string", "enum": list(VALID_STATUSES)}},
        },
    },
    {
        "name": "ticket_get",
        "description": "查看單筆工單，輸出會遮蔽個資",
        "inputSchema": {
            "type": "object",
            "required": ["ticket_id"],
            "properties": {"ticket_id": {"type": "string"}},
        },
    },
    {
        "name": "ticket_close",
        "description": "關閉 IT helpdesk 工單",
        "inputSchema": {
            "type": "object",
            "required": ["ticket_id"],
            "properties": {"ticket_id": {"type": "string"}},
        },
    },
]


class McpServer:
    def __init__(self, store_path: Path) -> None:
        self.tool = TicketTool(store_path)

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "ticket_create":
            ticket = self.tool.create(
                arguments["title"],
                arguments["description"],
                arguments["requester"],
                arguments.get("priority", "medium"),
            )
            return masked_ticket(ticket)
        if name == "ticket_list":
            return {"tickets": [masked_ticket(ticket) for ticket in self.tool.list(arguments.get("status"))]}
        if name == "ticket_get":
            return masked_ticket(self.tool.get(arguments["ticket_id"]))
        if name == "ticket_close":
            return masked_ticket(self.tool.close(arguments["ticket_id"]))
        raise ValueError(f"未知工具：{name}")


def send(message: dict[str, Any]) -> None:
    body = json.dumps(message, ensure_ascii=False).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(body)}\r\n\r\n".encode() + body)
    sys.stdout.buffer.flush()


def read_message() -> dict[str, Any] | None:
    headers: dict[str, str] = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        if line in (b"\r\n", b"\n"):
            break
        key, _, value = line.decode("ascii").partition(":")
        headers[key.lower()] = value.strip()
    length = int(headers.get("content-length", "0"))
    return json.loads(sys.stdin.buffer.read(length))


def main() -> None:
    parser = argparse.ArgumentParser(description="IT Helpdesk MCP Server")
    parser.add_argument("--store", type=Path, default=Path(__file__).with_name("tickets.json"))
    args = parser.parse_args()
    server = McpServer(args.store)
    while True:
        message = read_message()
        if message is None:
            return
        request_id = message.get("id")
        method = message.get("method")
        try:
            if method == "initialize":
                result = {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "it-helpdesk", "version": "0.1.0"},
                }
            elif method == "notifications/initialized":
                continue
            elif method == "tools/list":
                result = {"tools": TOOLS}
            elif method == "tools/call":
                params = message.get("params", {})
                output = server.call_tool(params["name"], params.get("arguments", {}))
                result = {"content": [{"type": "text", "text": json.dumps(output, ensure_ascii=False, indent=2)}]}
            else:
                raise ValueError(f"未知方法：{method}")
            if request_id is not None:
                send({"jsonrpc": "2.0", "id": request_id, "result": result})
        except (KeyError, TypeError, ValueError, OSError) as error:
            if request_id is not None:
                send({"jsonrpc": "2.0", "id": request_id, "error": {"code": -32602, "message": str(error)}})


if __name__ == "__main__":
    main()
