@echo off
REM ASCII only: avoid UTF-8 + chcp issues in cmd.exe
echo Stopping Backend Server / Frontend Server windows...
taskkill /f /fi "WINDOWTITLE eq Backend Server" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Frontend Server" >nul 2>&1
echo Done.
pause
