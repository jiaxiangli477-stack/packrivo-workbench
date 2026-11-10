@echo off
rem Health check + revive every 5 minutes, forever.
setlocal
set "HERE=%~dp0"
:loop
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HERE%watchdog.ps1" >nul 2>&1
timeout /t 300 /nobreak >nul
goto loop
