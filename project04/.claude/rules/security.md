---
description: 認證、授權與輸入處理的紅線
---

# 安全規則

## 兩種憑證，權限不同

| 憑證 | 給誰 | 能做什麼 |
| --- | --- | --- |
| JWT（`Depends(get_current_user)`） | 網頁登入 | 全部 |
| API Token `onh_…` | Obsidian 外掛 | 讀寫筆記，**不能**管理 token |

要限定只有網頁能做的操作，用 `Depends(get_session_user)` — 例如建立／撤銷 API token。
理由：token 洩漏時，攻擊者不該能自己再長出新的 token 來延長存取。

## 不可違反

1. API token 只存 sha256 雜湊（`security.hash_api_token`），明碼只在建立當下回傳一次。
2. 密碼用 bcrypt；超過 72 bytes 先 sha256 壓縮（bcrypt 的硬限制）。
3. 路徑一律 `mdutils.normalize_path()`，擋掉 `../`、絕對路徑、Windows 磁碟代號。
4. 前端渲染 Markdown 一律經過 DOMPurify。
5. `SECRET_KEY` 只從 `.env` 讀。**不要**把任何金鑰寫進程式碼或提交進版控。

## 上傳

- 副檔名白名單：`.md` / `.markdown` / `.txt` / `.zip`。
- 單檔上限 `MAX_UPLOAD_BYTES`，同步批次上限 `MAX_SYNC_BATCH` — 兩者都在 `.env` 可調。
- 解 zip 時逐項檢查 `file_size`，不要先整包解到記憶體或磁碟。
