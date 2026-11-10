@echo off
rem Stop only the workbench server on port 8795 (does not touch other node apps)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$c = Get-NetTCPConnection -LocalPort 8795 -State Listen -ErrorAction SilentlyContinue; if ($c) { $c.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force; Write-Host ('stopped pid ' + $_) } } else { Write-Host 'not running' }"
echo.
ping -n 3 127.0.0.1 >nul
