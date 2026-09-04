# Notes Hub

線上筆記管理系統 — 讓 Obsidian 把 Markdown 同步上來，登入後在網頁瀏覽、搜尋、編輯。

- **後端**：FastAPI + SQLAlchemy 2.0 + SQLite
- **前端**：React 18（免建置，不需要 Node）
- **同步**：Obsidian 外掛 + REST API + 個人 API Token
- **專案架構**：依 `agent-toolkit-poster` 的五層開發工具包組織（見下方 `.claude/`）

---

## 快速開始

```bash
# 1. 安裝（第一次）
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt

# 2. 設定（第一次）
cp .env.example .env
.venv/Scripts/python.exe -c "import secrets;print(secrets.token_urlsafe(48))"   # 貼到 .env 的 SECRET_KEY

# 3. 啟動
cd backend
../.venv/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

開 <http://127.0.0.1:8000> 註冊帳號即可使用。API 文件在 <http://127.0.0.1:8000/docs>。

測試：`cd backend && ../.venv/Scripts/python.exe -m pytest tests -q`（24 項）

> 本機的 `data/notes.db` 裡已有一個示範帳號 `demo@example.com` / `demo-password-1234`，
> 含 7 篇測試筆記。要從乾淨狀態開始，直接刪掉 `data/notes.db` 再重啟即可。

---

## 功能

| 功能 | 說明 |
| --- | --- |
| 帳號 | Email + 密碼註冊登入（bcrypt + JWT），資料每個帳號完全隔離 |
| Obsidian 同步 | 外掛比對雜湊後只上傳有變動的檔案；可存檔即同步或定時同步 |
| 網頁上傳 | 拖拉 `.md` 或整包 `vault.zip`，保留資料夾結構，自動略過 `.obsidian/` |
| 瀏覽 | 資料夾樹、標籤雲、全文搜尋（標題／路徑／內文）、多種排序 |
| Markdown | GFM 表格、待辦清單、程式碼區塊；輸出經 DOMPurify 消毒 |
| Obsidian 語法 | YAML frontmatter、`#行內標籤`、`[[wiki 連結]]` 與**反向連結** |
| 編輯 | 網頁上直接改內容或搬移路徑，存檔後標籤即時重新解析 |
| API Token | 給外掛用的長效 token，只存雜湊、可隨時撤銷 |

---

## 目錄結構

```
project04/
├── CLAUDE.md                  L1 記憶層：專案規則
├── .claude/                   五層開發工具包（見下節）
├── backend/
│   ├── app/
│   │   ├── main.py            FastAPI 入口，同時 serve 前端
│   │   ├── config.py          設定（可用 .env 覆寫）
│   │   ├── models.py          User / ApiToken / Note / Tag / NoteLink
│   │   ├── schemas.py         Pydantic 請求／回應
│   │   ├── security.py        bcrypt、JWT、API token
│   │   ├── deps.py            認證依賴（JWT 與 API token 兩種）
│   │   ├── mdutils.py         frontmatter／標籤／wiki link／路徑正規化
│   │   ├── services.py        upsert_note()：所有寫入的唯一入口
│   │   └── routers/           auth / tokens / notes / sync
│   ├── tests/test_api.py      24 項端到端與單元測試
│   └── requirements.txt
├── frontend/                  免建置 SPA（vendor 是本地副本）
├── obsidian-plugin/           Obsidian 外掛（複製即用）
└── data/notes.db              SQLite（.gitignore 已排除）
```

---

## API

所有端點都要 `Authorization: Bearer <token>`（JWT 或 `onh_…` API token）。

| 端點 | 說明 |
| --- | --- |
| `POST /api/auth/register` `login` · `GET /api/auth/me` | 帳號 |
| `GET POST /api/tokens` · `DELETE /api/tokens/{id}` | API token（**僅限網頁 JWT**） |
| `GET /api/notes` | 清單，支援 `q` `tag` `folder` `sort` `order` `limit` `offset` |
| `GET /api/notes/{id}` · `by-path` · `resolve` | 單篇；`resolve` 照 Obsidian 語意解析 `[[連結]]` |
| `GET /api/notes/{id}/backlinks` | 反向連結 |
| `PUT DELETE /api/notes/{id}` | 編輯／刪除 |
| `POST /api/notes/upload` | 網頁上傳（multipart，吃 md 與 zip） |
| `GET /api/sync/manifest` · `POST /api/sync/push` `delete` | Obsidian 同步 |
| `GET /api/tags` `folders` `stats` | 側邊欄資料 |

### 同步協定

```
外掛                                   伺服器
 GET  /api/sync/manifest      ───▶     { path, hash }[]
 本地算 sha256，挑出不一樣的
 POST /api/sync/push          ───▶     created / updated / unchanged
 POST /api/sync/delete        ───▶     （可選）清掉本地已刪的
```

比對放在客戶端，所以反覆同步幾乎不耗流量 — 內容沒變就回 `unchanged`，資料庫完全不動。

---

## Obsidian 外掛

1. 網頁「設定 → 建立 API Token」，複製 `onh_…`（只顯示一次）。
2. 把 `obsidian-plugin/` 複製到 `<vault>/.obsidian/plugins/notes-hub-sync/`。
3. Obsidian → 設定 → 第三方外掛 → 關閉安全模式 → 啟用 **Notes Hub Sync**。
4. 填入伺服器網址與 token，按「測試」，再按左側雲朵圖示同步。

細節見 [`obsidian-plugin/README.md`](obsidian-plugin/README.md)。

---

## `.claude/` 五層開發工具包

專案依照 `agent-toolkit-poster.png` 的五層架構組織，讓 Claude Code 在這個 repo 裡有一致的行為：

| 層 | 位置 | 內容 |
| --- | --- | --- |
| **L1 記憶** | `CLAUDE.md` + `.claude/rules/` | 專案規則；`rules/` 依 `paths` 限定套用到 backend／frontend |
| **L2 知識** | `.claude/skills/` | `add-api-endpoint`（新增端點的完整流程）、`obsidian-sync-protocol`（同步協定與雙邊雜湊一致性） |
| **L3 護欄** | `.claude/settings.json` + `.claude/hooks/` | PreToolUse 擋 `.env`／`vendor/`／`.db`／`.venv`；PostToolUse 檢查 Python 語法；Stop 跑後端測試 |
| **L4 委派** | `.claude/agents/` | `api-designer`（只設計不改碼）、`test-runner`（跑測試並診斷）、`frontend-reviewer`（抓免建置架構的違規） |
| **L5 分發** | `.claude/plugins/notes-hub-toolkit/` | `/dev-up`、`/smoke-test` 指令與 `deploy` 技能，附 `marketplace.json` |

> **hook 腳本必須存成 UTF-8 with BOM** — Windows PowerShell 5.1 沒有 BOM 就會用 ANSI 解讀，
> 中文字串被拆壞會導致腳本語法錯誤。另外 hook 要真的阻擋必須 `exit 2`，
> 且不能用 `Write-Error`（在 `ErrorActionPreference='Stop'` 下它會讓腳本以 1 結束）。

---

## 疑難排解

### 改了程式碼卻沒生效，或請求莫名卡住／被斷線

`--reload` 會開一個 reloader 父行程加一個真正服務的子行程。**如果父行程被強制中止
（不是在終端機按 Ctrl+C），子行程會變成孤兒繼續占著埠口。** Windows 允許新行程重複 bind
同一個埠，於是連線會隨機被那個跑著舊程式碼的孤兒接走 — 症狀是請求時好時壞、瀏覽器一直
pending，看起來像應用程式有 bug。

清乾淨再重開：

```powershell
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*uvicorn*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

平常在終端機用 Ctrl+C 結束就不會有這個問題。

### 用 curl 測 API 時中文變亂碼／回 422

Git Bash 會用系統 codepage（CP950）編碼命令列參數，`curl -d '{"path":"中文.md"}'`
送出去的不是 UTF-8。改用檔案：先把 JSON 寫成 UTF-8 檔，再 `curl --data-binary @檔案`。

---

## 已知限制

- **沒有 migration 工具**：目前靠 `Base.metadata.create_all()` 建表，改 schema 要先導入 Alembic。
- **不處理附件**：只同步 Markdown，`![[圖片.png]]` 在網頁上顯示成純文字標示。
- **搜尋用 `LIKE`**：筆記數量上千篇後應改用 SQLite FTS5 或 Postgres 全文檢索。
- **前端沒有打包**：這台機器沒有 Node。裝了 Node 之後可以把 `frontend/js/` 搬進 Vite + JSX，
  API 層（`api.js`）可以原封不動沿用。
- **SQLite 併發寫入有限**：多人使用請換 Postgres（見 `/deploy` 技能）。

上線前的檢查表在 `.claude/plugins/notes-hub-toolkit/skills/deploy/SKILL.md`。
