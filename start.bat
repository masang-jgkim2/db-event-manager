@echo off
setlocal EnableDelayedExpansion
REM Do not use chcp 65001 here: UTF-8 batch + cmd breaks Korean into garbage commands.
echo ============================================
echo   DQPM - start backend + frontend
echo ============================================
echo.

echo [1/3] Starting backend (new window^)...
start "Backend Server" cmd /k "cd /d %~dp0backend && npm run dev"

echo [2/3] Waiting for backend http://127.0.0.1:4000/api/health ...
set /a nTry=0
:wait_backend
timeout /t 2 /nobreak >nul
set /a nTry+=1
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4000/api/health' -UseBasicParsing -TimeoutSec 3; exit ([int]($r.StatusCode -ne 200)) } catch { exit 1 }"
if !errorlevel! equ 0 goto backend_ready
if !nTry! geq 45 (
  echo.
  echo WARNING: Backend not ready after 90s. Check the "Backend Server" window for errors.
  echo          Then refresh the browser or run start.bat again.
  goto start_frontend
)
goto wait_backend

:backend_ready
echo       Backend is up.
echo.

:start_frontend
echo [3/3] Starting frontend (new window^)...
start "Frontend Server" cmd /k "cd /d %~dp0front && npm run dev"

timeout /t 3 /nobreak >nul
echo.
echo Opening browser...
start http://localhost:5173

echo.
echo ============================================
echo   Done. Keep BOTH cmd windows open.
echo   Frontend: http://localhost:5173
echo   DNS dev:  http://db.masangsoft.com:5173  (same PC^)
echo   Backend:  http://localhost:4000
echo   Default:  admin / admin123
echo   Stop:     stop.bat  or  kill-dev-ports.bat
echo ============================================
echo.
pause
endlocal
