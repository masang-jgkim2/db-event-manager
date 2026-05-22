@echo off
chcp 65001 >nul
echo ============================================
echo   최신 소스 업데이트
echo ============================================
echo.

cd /d %~dp0

echo [1/3] 최신 소스 가져오는 중...
git pull origin cursor/readme-342b

echo.
echo [2/3] 백엔드 패키지 업데이트 중...
cd /d %~dp0backend
call npm install

echo.
echo [3/3] 프론트엔드 패키지 업데이트 중...
cd /d %~dp0front
call npm install

echo.
cd /d %~dp0
echo ============================================
echo   업데이트 완료! 현재 위치: %cd%
echo   start.bat 을 실행하세요.
echo ============================================
echo.
pause
