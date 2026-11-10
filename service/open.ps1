$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:8795'
$logDir = Join-Path $root 'data\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-Up {
    try {
        $r = Invoke-WebRequest -Uri "$url/api/health" -TimeoutSec 3 -UseBasicParsing
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

$ok = Test-Up
if (-not $ok) {
    $node = 'E:\Ai\node.js\node.exe'
    if (-not (Test-Path $node)) { $node = 'node' }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $node
    $psi.Arguments = 'app\server.mjs'
    $psi.WorkingDirectory = $root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    try { [System.Diagnostics.Process]::Start($psi) | Out-Null } catch {}

    for ($i = 0; $i -lt 45; $i++) {
        Start-Sleep -Milliseconds 700
        if (Test-Up) { $ok = $true; break }
    }
}

if ($ok) {
    Start-Process $url
} else {
    "$(Get-Date -Format s) open failed" | Add-Content -Path (Join-Path $logDir 'open.log')
    Start-Process explorer.exe $logDir
}
