---
description: FastAPI / SQLAlchemy 後端寫法
paths: ["backend/**"]
---

# 後端規則

## 分層

- `routers/` 只處理 HTTP：解析參數、呼叫 service、組回應。不要在 router 裡寫多步驟的商業邏輯。
- `services.py` 放跨端點共用的寫入邏輯。`upsert_note()` 是所有筆記寫入的唯一入口。
- `mdutils.py` 是純函式模組，不碰資料庫 — 因此可以單獨寫單元測試。

## SQLAlchemy 2.0

用 `select()` 風格，不要用已淘汰的 `Query` API：

```python
note = db.scalar(select(Note).where(Note.id == note_id, Note.user_id == user.id))
```

- 每個查詢都必須有 `user_id` 條件。
- 多筆用 `db.scalars(...).all()`，聚合用 `db.execute(...).all()`。
- `Note.tags` / `Note.links` 已設 `lazy="selectin"`，列清單時不會產生 N+1。

## 回應模型

- 一律標 `response_model=`，讓 FastAPI 過濾欄位 — 這是避免不小心回傳 `password_hash` 的第一道防線。
- 錯誤訊息用繁體中文，且**不要洩漏帳號是否存在**（見 `routers/auth.py` 的登入處理）。

## 測試

`backend/tests/test_api.py` 用記憶體 SQLite 覆寫 `get_db`，不會碰到 `data/notes.db`。
新增端點時至少補三種案例：正常路徑、未登入、跨使用者存取（應該 404 而不是 403，避免洩漏 id 是否存在）。
