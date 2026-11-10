$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runCmd = Join-Path $PSScriptRoot 'run.cmd'
$watch = Join-Path $PSScriptRoot 'watchdog.ps1'

# --- main server task: starts at logon, restarts on failure, no time limit ---
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument ('/c "' + $runCmd + '"') -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'PackrivoWorkbench' -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force `
    -Description 'Packrivo social media workbench: node server on 127.0.0.1:8795' | Out-Null
Write-Output 'registered: PackrivoWorkbench (at logon, restart on failure, no time limit)'

# --- watchdog: every 5 min, revive if health check fails ---
$wAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $watch + '"') -WorkingDirectory $root
$wTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$wSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew -StartWhenAvailable

Register-ScheduledTask -TaskName 'PackrivoWorkbenchWatchdog' -Action $wAction -Trigger $wTrigger `
    -Settings $wSettings -Principal $principal -Force `
    -Description 'Packrivo workbench watchdog: health check + restart every 5 min' | Out-Null
Write-Output 'registered: PackrivoWorkbenchWatchdog (every 5 min)'

Get-ScheduledTask -TaskName 'PackrivoWorkbench*' | Select-Object TaskName, State |
    Format-Table -AutoSize | Out-String -Width 100
