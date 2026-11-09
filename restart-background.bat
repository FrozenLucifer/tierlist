@echo off
call "%~dp0stop-background.bat"
start "" cmd /c "cd /d "%~dp0" && "%~dp0start-background.bat""
echo Тир-лист перезапущен в фоне.
