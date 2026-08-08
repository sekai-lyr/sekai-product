@echo off
setlocal
cd /d "%~dp0"

if not exist "data" mkdir "data"
if not exist "uploads" mkdir "uploads"
if not exist "logs" mkdir "logs"

echo Sekai Memory Book is starting...
echo Browser will open at http://localhost:18083/login

start "" /b powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:18083/login'"

"%~dp0runtime\bin\java.exe" ^
  -Dfile.encoding=UTF-8 ^
  -Dspring.profiles.active=desktop ^
  "-Dsekai.desktop.data-dir=%~dp0data" ^
  "-Dsekai.uploadRoot=%~dp0uploads" ^
  -jar "%~dp0app\sekai-memory-book.jar" ^
  > "%~dp0logs\app.log" 2> "%~dp0logs\app-error.log"

echo.
echo Sekai Memory Book has stopped. Logs are under "%~dp0logs".
pause
