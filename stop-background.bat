@echo off
set PORT=8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do set PID=%%a
if defined PID (
    taskkill /PID %PID% /F >nul 2>&1
    echo Процесс PID %PID% остановлен.
) else (
    echo Тир-лист на порту %PORT% не найден.
)
