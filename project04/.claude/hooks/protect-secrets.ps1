# PreToolUse 護欄：擋掉對機密檔與第三方檔案的寫入。
# exit 2 = 真的阻擋並把 stderr 回饋給 Claude；exit 0 = 放行。
# 注意：用 [Console]::Error.WriteLine 而不是 Write-Error —
# Write-Error 在 ErrorActionPreference=Stop 下會讓腳本以 1 結束，護欄就失效了。

$ErrorActionPreference = 'Continue'

function Deny($message) {
    [Console]::Error.WriteLine("護欄擋下：$message")
    exit 2
}

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
} catch {
    # 讀不到或解析失敗就不要擋住工作
    exit 0
}

$filePath = $null
if ($payload.tool_input) {
    if ($payload.tool_input.file_path)  { $filePath = $payload.tool_input.file_path }
    elseif ($payload.tool_input.path)   { $filePath = $payload.tool_input.path }
}
if (-not $filePath) { exit 0 }

$normalized = ($filePath -replace '\\', '/')
$leaf = Split-Path $normalized -Leaf

# .env.example 是範本，可以改；.env 有真的金鑰，不准動
if ($leaf -eq '.env') {
    Deny ".env 含有真實金鑰，不可由 agent 修改。要調整設定請改 .env.example，或請使用者自己編輯 .env。"
}

if ($normalized -match '/frontend/vendor/') {
    Deny "frontend/vendor/ 是第三方函式庫的本地副本，不可修改。要換版本請重新下載。"
}

if ($normalized -match '\.(db|sqlite|sqlite3)$' -or $normalized -match '/data/') {
    Deny "$leaf 是資料庫檔，請改用 API 或 SQLAlchemy model 操作資料，不要直接寫檔。"
}

if ($normalized -match '/\.venv/') {
    Deny ".venv/ 是虛擬環境，不可修改。要調整套件請改 backend/requirements.txt。"
}

exit 0