# PostToolUse 護欄：Python 檔改完立刻做語法檢查，壞了馬上回饋給 Claude 修。
# exit 2 = 把 stderr 當作回饋送回模型；exit 0 = 沒問題。

$ErrorActionPreference = 'Continue'

try {
    $raw = [Console]::In.ReadToEnd()
    if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$filePath = $null
if ($payload.tool_input -and $payload.tool_input.file_path) {
    $filePath = $payload.tool_input.file_path
}
if (-not $filePath) { exit 0 }
if ($filePath -notmatch '\.py$') { exit 0 }
if (-not (Test-Path $filePath)) { exit 0 }

$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir) { $projectDir = (Get-Location).Path }
$python = Join-Path $projectDir '.venv/Scripts/python.exe'
if (-not (Test-Path $python)) { exit 0 }

$output = & $python -m py_compile $filePath 2>&1
if ($LASTEXITCODE -ne 0) {
    $name = [System.IO.Path]::GetFileName($filePath)
    [Console]::Error.WriteLine("語法檢查失敗（$name）：")
    [Console]::Error.WriteLine(($output | Out-String))
    exit 2
}

exit 0