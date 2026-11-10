@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动 Packrivo 外贸社媒工作台...
node app\server.mjs
pause
