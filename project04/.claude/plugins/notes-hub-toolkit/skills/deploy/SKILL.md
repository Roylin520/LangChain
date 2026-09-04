---
name: deploy
description: 把 Notes Hub 部署到正式環境前的檢查與步驟。當使用者要上線、部署、換成 Postgres 或設定 HTTPS 時載入。
---

# 部署到正式環境

這個 MVP 的預設值是為了本機開發，上線前有幾項**必須**改。

## 上線前檢查表

- [ ] `SECRET_KEY` 換成隨機值：`python -c "import secrets;print(secrets.token_urlsafe(48))"`
      — 換掉後所有既有的登入 JWT 會失效（API token 不受影響，它不靠簽章）。
- [ ] `ALLOW_REGISTRATION=false`（自用站台開放註冊等於開放任何人建帳號）
- [ ] `CORS_ORIGINS` 改成實際網域的 JSON 陣列，不要留 localhost
- [ ] 一定要走 HTTPS — JWT 與 API token 都在 Authorization header 明文傳輸
- [ ] `data/` 目錄納入備份；SQLite 就是那一個檔案
- [ ] 反向代理設請求大小上限，與 `MAX_UPLOAD_BYTES` 對齊

## 啟動指令

```bash
cd backend
../.venv/Scripts/python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

正式環境建議放在 nginx / Caddy 後面處理 TLS 與靜態檔快取。
Windows 上沒有 gunicorn，多工用 `--workers N`（SQLite 併發寫入有限，超過 2–3 個 worker 就該換 Postgres）。

## 換成 PostgreSQL

1. `pip install "psycopg[binary]"`
2. `.env` 改 `DATABASE_URL=postgresql+psycopg://user:pass@host/notes`
3. 重啟即可 — `init_db()` 會建表。**注意目前沒有 migration 工具**，
   之後要改 schema 的話要先導入 Alembic，不能只靠 `create_all()`。

## 資料搬移

SQLite 的資料要搬到 Postgres，最省事的方式是用自己的 API：
拿一把 API token，從舊站 `GET /api/sync/manifest` + 逐篇 `GET /api/notes/{id}`，
再 `POST /api/sync/push` 到新站。
