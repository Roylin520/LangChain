"""Day 1 IT Helpdesk Ticket Tool.

Stores tickets in a local JSON file and exposes a small CLI for the first
helpdesk workflow: create, list, inspect, update, and close tickets.
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4


DEFAULT_STORE = Path(__file__).with_name("tickets.json")
VALID_PRIORITIES = ("low", "medium", "high", "urgent")
VALID_STATUSES = ("open", "in_progress", "closed")
EMAIL_PATTERN = re.compile(r"([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*(@[A-Za-z0-9.-]+\.[A-Za-z]{2,})")
PHONE_PATTERN = re.compile(r"(?<!\d)(09\d{2})[- ]?(\d{3})[- ]?(\d{3})(?!\d)")
TAIWAN_ID_PATTERN = re.compile(r"\b([A-Z])[12]\d{8}\b", re.IGNORECASE)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def mask_personal_info(value: str) -> str:
    """Mask common contact and identity values before displaying a ticket."""
    value = EMAIL_PATTERN.sub(r"\1***\2", value)
    value = PHONE_PATTERN.sub(r"\1-***-***", value)
    return TAIWAN_ID_PATTERN.sub(r"\1********", value)


def retry(operation: Any, attempts: int = 3, delay: float = 0.1) -> Any:
    """Retry a file operation when the operating system reports a transient error."""
    for attempt in range(attempts):
        try:
            return operation()
        except OSError:
            if attempt == attempts - 1:
                raise
            time.sleep(delay * (attempt + 1))


@dataclass
class Ticket:
    id: str
    title: str
    description: str
    requester: str
    priority: str = "medium"
    status: str = "open"
    created_at: str = ""
    updated_at: str = ""


class TicketTool:
    def __init__(self, store_path: Path = DEFAULT_STORE) -> None:
        self.store_path = Path(store_path)
        self.tickets = self._load()

    def _load(self) -> dict[str, Ticket]:
        if not self.store_path.exists():
            return {}
        try:
            content = retry(lambda: self.store_path.read_text(encoding="utf-8"))
            data = json.loads(content)
        except json.JSONDecodeError as error:
            raise ValueError(f"工單資料格式錯誤：{self.store_path}") from error
        return {item["id"]: Ticket(**item) for item in data}

    def _save(self) -> None:
        self.store_path.parent.mkdir(parents=True, exist_ok=True)
        payload = [asdict(ticket) for ticket in self.tickets.values()]
        content = json.dumps(payload, ensure_ascii=False, indent=2)
        retry(
            lambda: self.store_path.write_text(content, encoding="utf-8")
        )

    def create(
        self,
        title: str,
        description: str,
        requester: str,
        priority: str = "medium",
    ) -> Ticket:
        self._validate_priority(priority)
        timestamp = now()
        ticket = Ticket(
            id=f"INC-{uuid4().hex[:8].upper()}",
            title=title.strip(),
            description=description.strip(),
            requester=requester.strip(),
            priority=priority,
            created_at=timestamp,
            updated_at=timestamp,
        )
        if not ticket.title or not ticket.description or not ticket.requester:
            raise ValueError("title、description、requester 不可為空白")
        self.tickets[ticket.id] = ticket
        self._save()
        return ticket

    def list(self, status: str | None = None) -> list[Ticket]:
        if status is not None and status not in VALID_STATUSES:
            raise ValueError(f"status 必須是：{', '.join(VALID_STATUSES)}")
        tickets = self.tickets.values()
        if status:
            tickets = (ticket for ticket in tickets if ticket.status == status)
        return sorted(tickets, key=lambda ticket: ticket.created_at, reverse=True)

    def get(self, ticket_id: str) -> Ticket:
        try:
            return self.tickets[ticket_id.upper()]
        except KeyError as error:
            raise ValueError(f"找不到工單：{ticket_id}") from error

    def update(self, ticket_id: str, **changes: Any) -> Ticket:
        ticket = self.get(ticket_id)
        allowed = {"title", "description", "requester", "priority", "status"}
        unknown = set(changes) - allowed
        if unknown:
            raise ValueError(f"不支援的欄位：{', '.join(sorted(unknown))}")
        if "priority" in changes:
            self._validate_priority(changes["priority"])
        if "status" in changes and changes["status"] not in VALID_STATUSES:
            raise ValueError(f"status 必須是：{', '.join(VALID_STATUSES)}")
        for field, value in changes.items():
            if value is not None and str(value).strip():
                setattr(ticket, field, str(value).strip())
        ticket.updated_at = now()
        self._save()
        return ticket

    def close(self, ticket_id: str) -> Ticket:
        return self.update(ticket_id, status="closed")

    @staticmethod
    def _validate_priority(priority: str) -> None:
        if priority not in VALID_PRIORITIES:
            raise ValueError(f"priority 必須是：{', '.join(VALID_PRIORITIES)}")


def ticket_line(ticket: Ticket) -> str:
    title = mask_personal_info(ticket.title)
    requester = mask_personal_info(ticket.requester)
    return f"{ticket.id} | {ticket.status:<11} | {ticket.priority:<6} | {title} | {requester}"


def masked_ticket(ticket: Ticket) -> dict[str, str]:
    result = asdict(ticket)
    for field in ("title", "description", "requester"):
        result[field] = mask_personal_info(result[field])
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="IT Helpdesk Day 1 Ticket Tool")
    parser.add_argument("--store", type=Path, default=DEFAULT_STORE, help="JSON 儲存檔")
    commands = parser.add_subparsers(dest="command", required=True)

    create = commands.add_parser("create", help="建立工單")
    create.add_argument("--title", required=True)
    create.add_argument("--description", required=True)
    create.add_argument("--requester", required=True)
    create.add_argument("--priority", choices=VALID_PRIORITIES, default="medium")

    show_list = commands.add_parser("list", help="列出工單")
    show_list.add_argument("--status", choices=VALID_STATUSES)

    show = commands.add_parser("show", help="查看工單")
    show.add_argument("ticket_id")

    update = commands.add_parser("update", help="更新工單")
    update.add_argument("ticket_id")
    update.add_argument("--title")
    update.add_argument("--description")
    update.add_argument("--requester")
    update.add_argument("--priority", choices=VALID_PRIORITIES)
    update.add_argument("--status", choices=VALID_STATUSES)

    close = commands.add_parser("close", help="關閉工單")
    close.add_argument("ticket_id")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    tool = TicketTool(args.store)
    try:
        if args.command == "create":
            ticket = tool.create(
                args.title, args.description, args.requester, args.priority
            )
            print(f"已建立工單：{ticket.id}")
        elif args.command == "list":
            tickets = tool.list(args.status)
            print("\n".join(ticket_line(ticket) for ticket in tickets) or "目前沒有工單")
        elif args.command == "show":
            print(json.dumps(masked_ticket(tool.get(args.ticket_id)), ensure_ascii=False, indent=2))
        elif args.command == "update":
            changes = {
                field: getattr(args, field)
                for field in ("title", "description", "requester", "priority", "status")
                if getattr(args, field) is not None
            }
            print(f"已更新工單：{tool.update(args.ticket_id, **changes).id}")
        elif args.command == "close":
            print(f"已關閉工單：{tool.close(args.ticket_id).id}")
    except ValueError as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()