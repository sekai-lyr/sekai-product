@echo off
rem Start SekaiAI and its local ykd-7 travel backend.
cd /d "%~dp0"
python "%~dp0tools\start_services.py"
pause
