---
description: 跑一次完整的使用者流程煙霧測試（註冊 → token → 同步 → 搜尋）
---

對執行中的伺服器（預設 http://127.0.0.1:8000）跑端到端驗證。

**重要：不要把中文直接寫在 `curl -d` 參數裡** — Git Bash 會用系統 codepage 編碼，
JSON 會解析失敗。改用 Python 把 payload 寫成 UTF-8 檔，再 `curl --data-binary @檔案`。

驗證這幾件事，逐項回報通過與否：

1. `POST /api/auth/register` → 拿到 JWT（已存在就改用 `/api/auth/login`）
2. `POST /api/tokens` → 拿到 `onh_…` token
3. `POST /api/sync/push` 送 2–3 篇含 frontmatter、`#標籤`、`[[wiki 連結]]` 的筆記 → `created` 數正確
4. 同一份再送一次 → 全部 `unchanged`（雜湊比對有生效）
5. `GET /api/notes?q=關鍵字`、`?tag=`、`?folder=` → 篩選結果正確
6. `GET /api/notes/{id}/backlinks` → 找得到反向連結
7. 權限邊界：API token 讀 `/api/sync/manifest` 應 200，讀 `/api/tokens` 應 403，亂填 token 應 401

最後用表格總結，失敗的項目附上實際回應。
