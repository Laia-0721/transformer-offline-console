@echo off
setlocal
cd /d "%~dp0"

REM ASCII-only + CRLF to avoid cmd.exe encoding issues.
REM Run the local Electron shell from source.

if not exist "node_modules\electron\dist\electron.exe" (
  echo [ERROR] Electron is not installed.
  echo Run: npm install
  pause
  exit /b 1
)

set "ELECTRON_RUN_AS_NODE="
start "" "node_modules\electron\dist\electron.exe" .
exit /b 0