@echo off
setlocal
REM Kill processes LISTENING on backend (4000) and Vite (5173). Run from any folder.
echo Killing LISTEN on ports 4000 and 5173 (if any^)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(4000, 5173); foreach ($p in $ports) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $nPid = $_.OwningProcess; try { Stop-Process -Id $nPid -Force -ErrorAction Stop; Write-Host ('Stopped PID ' + $nPid + ' port ' + $p) } catch { Write-Host ('Skip PID ' + $nPid + ' port ' + $p + ' : ' + $_.Exception.Message) } } }"
echo Done.
pause
endlocal
