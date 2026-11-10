@echo off
rem Open Packrivo workbench: start server (minimized window) if needed, then open browser.
setlocal
set "ROOT=%~dp0.."
set "URL=http://127.0.0.1:8795"

rem already running?
netstat -ano | findstr /C:":8795 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 goto openbrowser

start "Packrivo 服务" /min cmd /c ""%~dp0run.cmd""

rem wait up to ~30s for health
set /a n=0
:wait
timeout /t 1 /nobreak >nul
powershell.exe -NoProfile -Command "try { (Invoke-WebRequest -Uri '%URL%/api/health' -TimeoutSec 2 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto openbrowser
set /a n+=1
if %n% lss 30 goto wait

echo server did not come up, opening log folder
start "" "%ROOT%\data\logs"
exit /b 1

:openbrowser
start "" "%URL%"
exit /b 0
