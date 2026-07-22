@echo off
chcp 65001 >nul 2>&1
cd /d "%~dp0"
title Nightcord Duel Network v1.3.0

echo ============================================
echo   Nightcord Duel Network v1.3.0
echo ============================================
echo.

rem 关闭仍占用8080端口的旧开发服务器，避免浏览器继续打开旧版本。
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo 正在关闭旧服务器 PID %%P ...
    taskkill /PID %%P /F >nul 2>&1
)

where node >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在使用 Node.js 启动...
    start "" /b "%~dp0scripts\open-browser.bat"
    node scripts\server.mjs
    goto :end
)

where python >nul 2>&1
if %errorlevel% equ 0 (
    echo 正在使用 Python 启动...
    start "" /b "%~dp0scripts\open-browser.bat"
    python -m http.server 8080 --bind 127.0.0.1
    goto :end
)

echo 未检测到 Node.js 或 Python。
echo 推荐安装 Node.js 18 或更高版本。
pause

:end
