---
description: 免建置 React 前端的寫法
paths: ["frontend/**"]
---

# 前端規則

## 沒有建置流程

這台機器沒有 Node。`frontend/` 是瀏覽器直接載入的靜態檔：

- **不能用 JSX**（沒有轉譯器）。改用 `htm` 標籤模板：`` html`<div class=${cls}>${child}</div>` ``。
- **不能用 `import` / `export`**。每個檔案是 IIFE，掛到 `window` 上的具名物件（`Api`、`UI`、`Markdown`）。
- 載入順序寫在 `index.html`：vendor → api → markdown → ui → app。新增檔案要記得掛上去。

`frontend/vendor/` 是 CDN 檔案的本地副本，不要改內容，也不要換成 `<script src="https://…">` —
離線就會整個掛掉。

## React 用法

用 `React.useState` 等 hook 的完整寫法（`var s = useState(x); var v = s[0]; var set = s[1];`），
因為沒有轉譯器就不能用陣列解構以外的新語法糖時，保持一致比較好讀。

## 安全

任何要塞進 `dangerouslySetInnerHTML` 的 HTML，都必須先過 `Markdown.render()`
— 它內建 DOMPurify 消毒。**不要**繞過它直接 `marked.parse()`。

## 樣式

`styles.css` 用 CSS 變數定義色票，淺色在 `:root`、深色在 `prefers-color-scheme: dark` 覆寫。
新增顏色時兩邊都要補，不要寫死色碼。
