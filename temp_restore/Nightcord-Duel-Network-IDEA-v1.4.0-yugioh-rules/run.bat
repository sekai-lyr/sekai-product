@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0Nightcord-Duel-Network-v1.4.0"
title Nightcord Duel Network v1.4.0 - DEV

echo ============================================
echo   Nightcord Duel Network v1.4.0 DEV
echo ============================================
echo.

rem 关闭占用8080端口的旧进程
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo 关闭旧服务器 PID %%P ...
    taskkill /PID %%P /F >nul 2>&1
)

echo 启动服务器...
start "" http://127.0.0.1:8080
node scripts\server.mjs
pause
