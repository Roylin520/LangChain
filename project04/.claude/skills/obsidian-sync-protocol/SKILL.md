---
name: obsidian-sync-protocol
description: 修改 Obsidian 同步流程、sync API 或外掛 main.js 時使用 — 說明 manifest/push/delete 三段式協定與雙邊必須一致的雜湊規則。
---

# Obsidian 同步協定

## 三段式流程

```
外掛                                  伺服器
 │  GET  /api/sync/manifest    ───▶   回 { path, hash, updated_at }[]
 │  ◀───────────────────────────      hash = sha256(檔案內容 UTF-8)
 │
 │  本地算同樣的 sha256，只挑不一樣的
 │
 │  POST /api/sync/push        ───▶   upsert_note()，每批最多 50 筆
 │  ◀───────────────────────────      回 created/updated/unchanged/errors
 │
 │  POST /api/sync/delete      ───▶   （可選）清掉本地已刪的路徑
```

## 雙邊必須一致的地方

雜湊算法在兩邊各寫一次，改動時**必須同時改**：

- 伺服器：`backend/app/security.py` 的 `content_hash()`
- 外掛：`obsidian-plugin/main.js` 的 `sha256Hex()`

兩邊都是「檔案原始內容（含 frontmatter）的 UTF-8 sha256」。
只要有一邊改成算 body 或加鹽，`unchanged` 判定就會全部失準，變成每次都重傳整個 vault。

## 為什麼是外掛去比對，不是伺服器

manifest 只有路徑與雜湊，幾 KB；如果讓伺服器判斷，外掛就得先把整個 vault 傳上來。
比對成本放在客戶端，是這個設計省流量的關鍵。

## 外掛開發注意

- HTTP 一律用 Obsidian 的 `requestUrl()`，不要用 `fetch()` — 前者不受 CORS 限制。
- 讀檔用 `vault.cachedRead()`，不要用 `vault.read()`（整包同步時差很多）。
- `vault.on("modify")` 在打字時會狂觸發，一定要去抖（目前 4 秒）。
- 外掛是免建置的純 JS：不能用 TypeScript、不能 `import`，維持 `require()` + `module.exports`。

## 手動驗證

```bash
curl -s http://127.0.0.1:8000/api/sync/manifest -H "Authorization: Bearer onh_…"
```
