@echo off
setlocal
cd /d "%~dp0"

REM This batch file is intentionally ASCII-only and uses CRLF line endings.
REM Keeping the content ASCII avoids Chinese mojibake in legacy cmd.exe.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 18+ first.
  pause
  exit /b 1
)

REM Electron must not run in Node-only mode while packaging.
set "ELECTRON_RUN_AS_NODE="
set "CSC_IDENTITY_AUTO_DISCOVERY=false"

if not exist "node_modules\electron\dist\electron.exe" (
  echo [INFO] Installing local build dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo [INFO] Building offline console package...
call npm run build:win
if errorlevel 1 (
  echo [ERROR] Build failed.
  pause
  exit /b 1
)

echo.
echo [DONE] Installer and portable build are available in the dist folder.
echo        Installer: Transformer-Offline-Console-Setup-2.0.0.exe
echo        Portable : Transformer-Offline-Console-Portable-2.0.0.exe
echo.
pause
exit /b 0