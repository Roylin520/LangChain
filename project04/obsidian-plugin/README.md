# Notes Hub Sync（Obsidian 外掛）

免建置外掛，不需要 npm / TypeScript，複製資料夾就能用。

## 安裝

1. 把整個 `obsidian-plugin/` 資料夾複製到 vault 的 `.obsidian/plugins/` 底下，並改名為 `notes-hub-sync`：

   ```
   <你的 vault>/.obsidian/plugins/notes-hub-sync/
   ├── main.js
   └── manifest.json
   ```

2. Obsidian → 設定 → 第三方外掛 → 關閉「安全模式」→ 重新整理 → 啟用 **Notes Hub Sync**。
3. 在外掛設定填入伺服器網址與 API Token（網頁版「設定 → 建立 API Token」取得），按「測試」確認連線。

## 使用

| 動作 | 位置 |
| --- | --- |
| 整包同步 | 左側工具列雲朵圖示，或指令面板「立即同步整個 vault」 |
| 只同步目前這篇 | 指令面板「只同步目前這篇筆記」 |
| 存檔自動同步 | 設定裡打開，停止編輯 4 秒後自動送出 |
| 定時同步 | 設定裡填分鐘數（0 = 關閉），改完需重新載入外掛 |

## 同步邏輯

1. 先向伺服器拿 `manifest`（每篇筆記的 sha256）。
2. 本地算出同樣的雜湊，**只上傳內容真的變了的檔案**，所以反覆同步幾乎不耗流量。
3. 「刪除伺服器多出來的筆記」預設關閉 — 開啟後本地刪檔才會連帶刪雲端。

附件（圖片、PDF）目前不會上傳，`![[圖片.png]]` 在網頁上會顯示成純文字標示。
