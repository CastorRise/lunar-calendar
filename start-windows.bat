@echo off
setlocal
cd /d "%~dp0"
echo.
echo Lunar Calendar - local launch
echo.
where node >nul 2>&1
if errorlevel 1 goto missing
where npm >nul 2>&1
if errorlevel 1 goto missing
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto oldversion
if not exist "node_modules\.bin\vite.cmd" (
  echo Installing dependencies. Internet access is needed on first run...
  call npm ci
  if errorlevel 1 goto installfailed
)
echo Starting the app and opening your browser. Close this window to stop the server.
call npm run dev -- --host 127.0.0.1 --open
echo Server stopped.
pause
exit /b
:missing
echo Node.js and npm were not found. Install Node.js 22 or later from https://nodejs.org/
pause
exit /b 1
:oldversion
echo Node.js 22 or later is required. Download it from https://nodejs.org/
pause
exit /b 1
:installfailed
echo Dependency installation failed. Check your connection and try again.
pause
exit /b 1
