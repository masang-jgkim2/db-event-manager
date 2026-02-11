@echo off
chcp 65001 >nul
echo ============================================
echo   이벤트 매니저 서버 시작
echo ============================================
echo.

:: 백엔드 서버 실행 (새 창)
echo [1/2] 백엔드 서버 시작 중...
start "Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"

:: 2초 대기 후 프론트 실행
timeout /t 2 /nobreak >nul

:: 프론트엔드 서버 실행 (새 창)
echo [2/2] 프론트엔드 서버 시작 중...
start "Frontend Server" cmd /k "cd /d %~dp0front && npm run dev"

:: 3초 대기 후 브라우저 자동 열기
timeout /t 3 /nobreak >nul
echo.
echo 브라우저를 열고 있습니다...
start http://localhost:5173

echo.
echo ============================================
echo   서버가 시작되었습니다!
echo   프론트: http://localhost:5173
echo   백엔드: http://localhost:4000
echo   기본 계정: admin / admin123
echo ============================================
echo.
pause
