@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Instala Node.js 24 desde https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules call npm install
start "" http://localhost:5173
call npm run dev
