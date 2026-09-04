# Stop 護欄：這一輪結束前跑一次後端測試，把結果貼在對話最後。
# 一律 exit 0 — 只回報、不阻止結束。測試失敗時 Claude 會看到摘要並決定要不要修。

$ErrorActionPreference = 'Continue'

$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir) { $projectDir = (Get-Location).Path }

$python = Join-Path $projectDir '.venv/Scripts/python.exe'
$backend = Join-Path $projectDir 'backend'
if (-not (Test-Path $python) -or -not (Test-Path (Join-Path $backend 'tests'))) { exit 0 }

# 這一輪沒動過後端就不用跑，省時間
$recent = Get-ChildItem -Path $backend -Filter *.py -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt (Get-Date).AddMinutes(-10) }
if (-not $recent) { exit 0 }

Push-Location $backend
try {
    $output = & $python -m pytest tests -q --no-header -p no:cacheprovider 2>&1
    $summary = ($output | Select-String -Pattern '(passed|failed|error)' | Select-Object -Last 1).ToString().Trim()
    if ($LASTEXITCODE -eq 0) {
        Write-Output "[Stop hook] 後端測試通過 — $summary"
    } else {
        Write-Output "[Stop hook] 後端測試失敗 — $summary"
        $output | Select-String -Pattern '^(FAILED|E  )' | Select-Object -First 8 | ForEach-Object {
            Write-Output "  $($_.ToString().Trim())"
        }
    }
} finally {
    Pop-Location
}

exit 0
