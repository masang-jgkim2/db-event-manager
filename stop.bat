@echo off
chcp 65001 >nul
echo 서버를 종료합니다...
taskkill /f /fi "WINDOWTITLE eq Backend Server" >nul 2>&1
taskkill /f /fi "WINDOWTITLE eq Frontend Server" >nul 2>&1
echo 서버가 종료되었습니다.
pause
