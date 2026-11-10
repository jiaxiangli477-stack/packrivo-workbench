@echo off
chcp 65001 >nul
echo === port 8795 ===
netstat -ano | findstr ":8795"
echo.
echo === node processes ===
tasklist /fi "imagename eq node.exe" /fo table
echo.
echo === health ===
powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:8795/api/health' -TimeoutSec 5 -UseBasicParsing).Content } catch { 'DOWN: ' + $_.Exception.Message }"
echo.
echo === watchdog log (last 5) ===
powershell.exe -NoProfile -Command "Get-Content '%~dp0..\data\logs\watchdog.log' -Tail 5 -ErrorAction SilentlyContinue"
