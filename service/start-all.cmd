@echo off
rem Thin wrapper: real logic lives in start-all.ps1 (path/quote safe)
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-all.ps1"
