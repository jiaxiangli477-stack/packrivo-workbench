@echo off
chcp 65001 >nul
cd /d "%~dp0.."

set "ROOT=%~dp0.."
set "TMP=%ROOT%\tools\tmp"
set "TEMP=%TMP%"
if not exist "%TMP%" mkdir "%TMP%"
if not exist "%ROOT%\data\logs" mkdir "%ROOT%\data\logs"

rem 只在本机用保持 127.0.0.1；要让同局域网别的设备访问，把下面一行改成 0.0.0.0
set "SWB_HOST=127.0.0.1"
set "SWB_PORT=8795"

set "NODE=E:\Ai\node.js\node.exe"
if not exist "%NODE%" set "NODE=node"

:loop
echo [%date% %time%] starting server >> "%ROOT%\data\logs\server.log"
"%NODE%" app\server.mjs >> "%ROOT%\data\logs\server.log" 2>&1
echo [%date% %time%] server exited code %ERRORLEVEL%, restart in 5s >> "%ROOT%\data\logs\server.log"
timeout /t 5 /nobreak >nul
goto loop
