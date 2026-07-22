@echo off
title Sekai Anime - 一键看番
chcp 65001 >nul

echo ========================================
echo   Sekai Anime - 启动中...
echo ========================================

:: 查找 Chrome 路径
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set CHROME_PATH="%ProgramFiles%\Google\Chrome\Application\chrome.exe"

:: 检查服务是否在运行
echo 正在检查服务...
curl -s -o nul -w "%%{http_code}" http://localhost:8090/ 2>nul | findstr "200" >nul
if %errorlevel% neq 0 (
    echo 服务未运行，正在启动...
    cd /d "%~dp0SekaiAnimeVideo"
    start "SekaiAnime" /MIN java -Xmx512m -jar "target\SekaiAnimeVideo-0.0.1-SNAPSHOT.jar"
    echo 等待服务启动...
    :waitloop
    timeout /t 3 /nobreak >nul
    curl -s -o nul -w "%%{http_code}" http://localhost:8090/ 2>nul | findstr "200" >nul
    if errorlevel 1 goto waitloop
    echo 服务已启动!
) else (
    echo 服务已在运行!
)

:: 打开 Chrome 并启用 HEVC 硬件解码
echo 正在打开 Chrome (已启用 HEVC 硬件解码)...
if defined CHROME_PATH (
    start "" %CHROME_PATH% --enable-features=PlatformHEVCDecoderSupport --enable-hardware-overlays --ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy --new-window "http://localhost:8090/"
) else (
    start "" "http://localhost:8090/"
)

echo.
echo ========================================
echo   已启动! 请访问 http://localhost:8090/
echo.
echo   如果视频有声音没画面:
echo   1. 打开 Microsoft Store
echo   2. 搜索并安装 "HEVC Video Extensions"
echo   3. 重启 Chrome
echo   或使用 Edge 浏览器 (自带 HEVC 支持)
echo ========================================
echo.
pause
