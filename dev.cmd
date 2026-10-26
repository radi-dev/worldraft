@echo off
rem Worldraft - developer mode (Vite + uvicorn with hot reload). Needs Node.js 22 and uv.
rem Equivalent to `npm run dev`.
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed ^(or not on PATH^).
  echo Install Node.js 22 LTS from https://nodejs.org/
  echo ^(nvm-windows users: nvm install 22 ^&^& nvm use 22^)
  echo then open a new window and run this again.
  pause
  exit /b 1
)

call npm run dev -- %*
if errorlevel 1 pause
endlocal
