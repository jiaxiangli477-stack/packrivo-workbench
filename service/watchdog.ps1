$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$log = Join-Path $root 'data\logs\watchdog.log'
New-Item -ItemType Directory -Force -Path (Split-Path $log) | Out-Null

$url = 'http://127.0.0.1:8795/api/health'
$ok = $false
try {
    $r = Invoke-WebRequest -Uri $url -TimeoutSec 6 -UseBasicParsing
    if ($r.StatusCode -eq 200) { $ok = $true }
} catch { $ok = $false }

if ($ok) { exit 0 }

"$(Get-Date -Format s) health check failed, restarting" | Add-Content -Path $log -Encoding UTF8

# 杀掉占用端口的残留进程
$conn = Get-NetTCPConnection -LocalPort 8795 -State Listen
if ($conn) {
    $conn.OwningProcess | Sort-Object -Unique | ForEach-Object {
        try { Stop-Process -Id $_ -Force } catch {}
        "$(Get-Date -Format s) killed pid $_" | Add-Content -Path $log -Encoding UTF8
    }
    Start-Sleep -Seconds 2
}

# 用 WMI 拉起 start-all.cmd（不依赖计划任务，普通用户可用）
$startAll = Join-Path $root 'service\start-all.cmd'
try {
    $cmd = 'cmd.exe /c ""' + $startAll + '""'
    ([wmiclass]'Win32_Process').Create($cmd, $root, $null) | Out-Null
    "$(Get-Date -Format s) launched start-all.cmd" | Add-Content -Path $log -Encoding UTF8
} catch {
    "$(Get-Date -Format s) launch failed: $($_.Exception.Message)" | Add-Content -Path $log -Encoding UTF8
}
Start-Sleep -Seconds 10

$ok2 = $false
try {
    $r2 = Invoke-WebRequest -Uri $url -TimeoutSec 8 -UseBasicParsing
    if ($r2.StatusCode -eq 200) { $ok2 = $true }
} catch { $ok2 = $false }
"$(Get-Date -Format s) restart result: $ok2" | Add-Content -Path $log -Encoding UTF8
if (-not $ok2) { exit 1 }
