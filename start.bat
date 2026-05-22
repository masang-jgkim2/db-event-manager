@echo off
setlocal
REM Do not use chcp 65001 here: UTF-8 batch + cmd breaks Korean into garbage commands.
echo ============================================
echo   DQPM - start backend + frontend
echo ============================================
echo.

echo [1/2] Starting backend (new window^)...
start "Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/2] Starting frontend (new window^)...
start "Frontend Server" cmd /k "cd /d %~dp0front && npm run dev"

timeout /t 3 /nobreak >nul
echo.
echo Opening browser...
start http://localhost:5173

echo.
echo ============================================
echo   Done. URLs:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:4000
echo   Default:  admin / admin123
echo ============================================
echo.
pause
endlocal
