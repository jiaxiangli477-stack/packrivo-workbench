$ErrorActionPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$port = 8795

$listening = Get-NetTCPConnection -LocalPort $port -State Listen
if (-not $listening) {
    $cmd = 'cmd.exe /c ""' + (Join-Path $PSScriptRoot 'run.cmd') + '""'
    $r = ([wmiclass]'Win32_Process').Create($cmd, $root, $null)
    Write-Output ("server: started (wmi {0}, pid {1})" -f $r.ReturnValue, $r.ProcessId)
} else {
    Write-Output ("server: already running (pid {0})" -f (($listening.OwningProcess | Sort-Object -Unique) -join ','))
}

$wd = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'watchdog-loop' }
if (-not $wd) {
    $cmd2 = 'cmd.exe /c ""' + (Join-Path $PSScriptRoot 'watchdog-loop.cmd') + '""'
    $r2 = ([wmiclass]'Win32_Process').Create($cmd2, $root, $null)
    Write-Output ("watchdog: started (wmi {0}, pid {1})" -f $r2.ReturnValue, $r2.ProcessId)
} else {
    Write-Output ("watchdog: already running (pid {0})" -f (($wd.ProcessId) -join ','))
}
