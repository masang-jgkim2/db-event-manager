@echo off
REM ASCII only: avoid UTF-8 + chcp issues in cmd.exe
echo Stopping Backend / Frontend / Storybook windows...
taskkill /f /fi "WINDOWTITLE eq Backend Server" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Frontend Server" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Storybook Server" >nul 2>&1
echo Done.
pause
