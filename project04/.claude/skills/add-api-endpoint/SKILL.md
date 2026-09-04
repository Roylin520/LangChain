---
name: add-api-endpoint
description: 在 Notes Hub 後端新增一個 API 端點時使用 — 涵蓋 schema、router、權限、測試的完整步驟與慣例。當使用者要求新增／修改 FastAPI 端點、API 路由或後端功能時載入。
---

# 新增 API 端點

照這個順序做，才不會漏掉多租戶隔離或測試。

## 1. 先決定權限層級

| 情境 | 依賴 |
| --- | --- |
| 一般筆記操作（Obsidian 也要能用） | `user: User = Depends(get_current_user)` |
| 只有網頁能做（帳號、token 管理） | `user: User = Depends(get_session_user)` |

## 2. 在 `schemas.py` 定義請求／回應

- 回應模型加 `model_config = ConfigDict(from_attributes=True)` 才能直接回 ORM 物件。
- 所有字串欄位標 `Field(max_length=...)` — 這是免費的輸入驗證。

## 3. 寫 router

放進 `backend/app/routers/` 對應的檔案；新開檔案記得在 `main.py` 補 `app.include_router(...)`。

```python
@router.get("/notes/{note_id}/xxx", response_model=XxxOut)
def get_xxx(
    note_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> XxxOut:
    note = _owned_note(db, user, note_id)   # 這一行同時完成「存在」與「屬於我」兩個檢查
    ...
```

**每個查詢都要有 `Note.user_id == user.id`。** 查不到就 404，不要回 403 — 403 會洩漏這個 id 存在。

## 4. 寫入邏輯走 service

要改到筆記內容，呼叫 `services.upsert_note()`，不要自己組 `Note(...)`。
它負責：路徑正規化 → 雜湊比對 → frontmatter/標籤/連結解析 → 標籤關聯更新。

## 5. 補測試

在 `backend/tests/test_api.py` 加三個案例：

```python
def test_xxx_happy_path(client): ...
def test_xxx_requires_auth(client):        # 沒帶 token → 401
def test_xxx_is_isolated_per_user(client): # 別人的資料 → 404
```

跑：`cd backend && ../.venv/Scripts/python.exe -m pytest tests -q`

## 6. 前端接線

在 `frontend/js/api.js` 加對應方法（沿用既有的 `request()` 包裝，它已處理 token 與錯誤訊息）。
