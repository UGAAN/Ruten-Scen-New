@echo off
title Install Ugaan Hub Zero-Click Auto-Updater on PC-2
color 0A
echo ========================================================
echo     UGAAN HUB - ZERO-CLICK AUTO-UPDATER INSTALLER
echo ========================================================
echo.
echo Installing background auto-sync into Windows Startup...

set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy /y "%~dp0silent-auto-update.vbs" "%STARTUP_DIR%\UgaanHubAutoUpdate.vbs" >nul

echo.
echo [SUCCESS] Auto-Updater installed in Windows Startup!
echo Whenever Windows starts, it will silently check GitHub every 60 seconds.
echo Starting auto-updater service now...
start "" wscript "%STARTUP_DIR%\UgaanHubAutoUpdate.vbs"

echo.
echo ========================================================
echo Done! You can now close this window.
echo ========================================================
pause
