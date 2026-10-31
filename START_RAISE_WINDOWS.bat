@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required. Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
start "Raise MVP" cmd /k "cd /d "%~dp0" && npm start"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
