# Notes Hub — 專案規則（L1 記憶層）

線上筆記管理系統：讓 Obsidian 把 Markdown 同步上來，網頁端登入後瀏覽、搜尋、編輯。

本檔是 Claude Code 的「上下文」，不是強制力。要**硬擋**的行為寫在 `.claude/hooks/`（L3 護欄層）。

## 技術棧

| 層 | 選型 | 理由 |
| --- | --- | --- |
| 後端 | FastAPI + SQLAlchemy 2.0 + SQLite | 單檔資料庫免安裝；換 Postgres 只要改 `DATABASE_URL` |
| 認證 | JWT（網頁）+ 長效 API Token（Obsidian） | 兩種客戶端的生命週期不同，不該共用同一種憑證 |
| 前端 | React 18 UMD + htm，**無建置流程** | 這台機器沒有 Node；`frontend/vendor/` 是本地副本，離線可用 |
| 外掛 | 純 JS 的 Obsidian plugin | 同樣不需要 npm，複製資料夾就能裝 |

## 目錄

```
backend/app/        FastAPI：routers/ 只做 HTTP，商業邏輯在 services.py
frontend/           靜態 SPA，由 FastAPI 的 /static 直接 serve
obsidian-plugin/    Obsidian 外掛（main.js + manifest.json）
.claude/            五層開發工具包：rules / skills / hooks / agents / plugins
data/notes.db       SQLite（已被 .gitignore 排除）
```

## 開發指令

```bash
# 啟動（含自動 reload）
.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000   # cwd = backend/

# 測試
cd backend && ../.venv/Scripts/python.exe -m pytest tests -q
```

網頁在 http://127.0.0.1:8000 ，API 文件在 /docs。

## 動手前先知道的三件事

1. **所有查詢都要帶 `user_id`。** 這是多租戶系統，漏掉一次就是資料外洩。新增查詢時對照
   `backend/app/routers/notes.py` 的 `_owned_note()` 寫法。
2. **筆記路徑一律走 `mdutils.normalize_path()`。** 使用者與外掛送上來的 path 不可信，
   `../` 和絕對路徑都要被洗掉。
3. **寫入邏輯只有一條路：`services.upsert_note()`。** 上傳、同步、網頁編輯都呼叫它，
   標籤解析與雜湊比對才不會有三套行為。

## 模組化規則

- @.claude/rules/backend.md
- @.claude/rules/frontend.md
- @.claude/rules/security.md

## 慣例

- 註解與 UI 文案用**繁體中文**；程式碼識別字用英文。
- 註解寫「為什麼」，不要覆述程式碼在做什麼。
- 後端新增端點時，同一個 PR 要補 `backend/tests/test_api.py` 的測試。
- 不要為了「之後可能會用到」預先加抽象層；這是 MVP。
