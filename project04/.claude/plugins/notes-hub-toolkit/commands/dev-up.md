---
description: 啟動 Notes Hub 開發伺服器並確認可以連線
---

啟動後端（背景執行）並驗證：

1. 用 `run_in_background` 執行：
   `cd backend && ../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000`
2. 輪詢 `curl -s http://127.0.0.1:8000/api/health` 直到回 `{"status":"ok"...}`。
3. 確認靜態檔有出來：`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/static/js/app.js`
4. 回報網址：網頁 http://127.0.0.1:8000 、API 文件 http://127.0.0.1:8000/docs

若 8000 埠被佔用，換 8001 並在回報中說明。
