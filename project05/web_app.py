"""Day 3 minimal Web UI for the IT Helpdesk Ticket Tool."""

from __future__ import annotations

import argparse
import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from ticket_tool import TicketTool, VALID_PRIORITIES, VALID_STATUSES, masked_ticket


class HelpdeskHandler(BaseHTTPRequestHandler):
    tool: TicketTool

    def do_GET(self) -> None:
        route = urlparse(self.path)
        if route.path == "/":
            self._send_html(self._render_dashboard())
        elif route.path == "/api/tickets":
            status = parse_qs(route.query).get("status", [None])[0]
            self._send_json([masked_ticket(ticket) for ticket in self.tool.list(status)])
        else:
            self.send_error(404, "找不到頁面")

    def do_POST(self) -> None:
        route = urlparse(self.path)
        if route.path != "/api/tickets":
            self.send_error(404, "找不到 API")
            return
        length = int(self.headers.get("Content-Length", 0))
        try:
            payload = json.loads(self.rfile.read(length))
            ticket = self.tool.create(
                payload["title"],
                payload["description"],
                payload["requester"],
                payload.get("priority", "medium"),
            )
        except (KeyError, json.JSONDecodeError, ValueError) as error:
            self._send_json({"error": str(error)}, status=400)
            return
        self._send_json(masked_ticket(ticket), status=201)

    def _render_dashboard(self) -> str:
        rows = []
        for ticket in self.tool.list():
            public = masked_ticket(ticket)
            rows.append(
                "<tr>"
                f"<td>{html.escape(public['id'])}</td>"
                f"<td>{html.escape(public['title'])}</td>"
                f"<td>{html.escape(public['requester'])}</td>"
                f"<td><span class='status'>{html.escape(public['status'])}</span></td>"
                f"<td>{html.escape(public['priority'])}</td>"
                "<td><details><summary>查看</summary>"
                f"<p><strong>描述：</strong>{html.escape(public['description'])}</p>"
                f"<p><strong>建立：</strong>{html.escape(public['created_at'])}</p>"
                f"<p><strong>更新：</strong>{html.escape(public['updated_at'])}</p>"
                "</details></td>"
                "</tr>"
            )
        table = "".join(rows) or "<tr><td colspan='6'>目前沒有工單</td></tr>"
        priority_options = "".join(
            f"<option value='{priority}'>{priority}</option>"
            for priority in VALID_PRIORITIES
        )
        return f"""<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IT Helpdesk</title>
<style>
:root {{ color-scheme: light; font-family: Segoe UI, sans-serif; background: #f5f3ee; color: #20233f; }}
body {{ max-width: 1100px; margin: 0 auto; padding: 36px 20px; }}
h1 {{ margin-bottom: 6px; }} .subtitle {{ color: #666477; }}
section {{ background: white; border: 1px solid #dedbe0; border-radius: 8px; padding: 22px; margin-top: 22px; box-shadow: 0 8px 20px #2623410d; }}
form {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }}
label {{ display: grid; gap: 6px; font-weight: 600; }} .wide {{ grid-column: 1 / -1; }}
input, textarea, select, button {{ font: inherit; padding: 10px; border: 1px solid #c9c6cf; border-radius: 5px; }}
textarea {{ min-height: 80px; resize: vertical; }} button {{ background: #f36d2f; border: 0; color: white; cursor: pointer; font-weight: 700; }}
.table-wrap {{ overflow-x: auto; }} table {{ width: 100%; border-collapse: collapse; }} th, td {{ text-align: left; padding: 12px 8px; border-bottom: 1px solid #ece9e5; }} th {{ color: #666477; font-size: .85rem; }} .status {{ background: #e8f1f5; padding: 4px 8px; border-radius: 12px; }}
@media (max-width: 650px) {{ form {{ grid-template-columns: 1fr; }} .wide {{ grid-column: auto; }} }}
</style></head><body>
<h1>IT Helpdesk</h1><div class="subtitle">Day 3 Ticket Tool Web UI</div>
<section><h2>建立工單</h2><form id="ticket-form">
<label>標題<input name="title" required></label>
<label>申請人<input name="requester" required></label>
<label class="wide">問題描述<textarea name="description" required></textarea></label>
<label>優先級<select name="priority">{priority_options}</select></label>
<button type="submit">建立工單</button></form><p id="message"></p></section>
<section><h2>工單列表</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>標題</th><th>申請人</th><th>狀態</th><th>優先級</th><th>詳情</th></tr></thead><tbody>{table}</tbody></table></div></section>
<script>
document.querySelector('#ticket-form').addEventListener('submit', async (event) => {{
 event.preventDefault(); const payload = Object.fromEntries(new FormData(event.target));
 const response = await fetch('/api/tickets', {{method:'POST', headers:{{'Content-Type':'application/json'}}, body:JSON.stringify(payload)}});
 const result = await response.json(); document.querySelector('#message').textContent = response.ok ? `已建立 ${{result.id}}` : result.error;
 if (response.ok) event.target.reset();
}});
</script></body></html>"""

    def _send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, body: str) -> None:
        encoded = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="IT Helpdesk Web UI")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--store", type=Path, default=Path(__file__).with_name("tickets.json"))
    args = parser.parse_args()
    HelpdeskHandler.tool = TicketTool(args.store)
    server = ThreadingHTTPServer((args.host, args.port), HelpdeskHandler)
    print(f"IT Helpdesk running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
