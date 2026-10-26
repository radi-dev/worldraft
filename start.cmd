@echo off
rem Worldraft - run the app (user mode). Needs only uv; no Node.js, no Python setup.
rem Usage: start.cmd [--port 8010] [--no-open]   (or double-click)
setlocal
cd /d "%~dp0"

where uv >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.local\bin\uv.exe" (
    set "PATH=%USERPROFILE%\.local\bin;%PATH%"
  ) else (
    echo uv is not installed ^(or not on PATH^).
    echo Install it with:  winget install --id=astral-sh.uv -e
    echo or see https://docs.astral.sh/uv/getting-started/installation/
    echo then open a new window and run this again.
    pause
    exit /b 1
  )
)

rem First run installs the locked backend dependencies (and a private Python if
rem needed) into backend\.venv. Later runs start immediately.
uv run --project backend --locked --no-dev worldraft %*
if errorlevel 1 pause
endlocal
