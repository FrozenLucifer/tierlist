@echo off
cd /d "%~dp0"
powershell -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd \"%~dp0\"; python -m tierlist_app' -WindowStyle Hidden"
echo.
echo Тир-лист запущен в фоне. Порт: 8000
echo Проверка: http://127.0.0.1:8000
echo Остановка: stop-background.bat
