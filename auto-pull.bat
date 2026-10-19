@echo off
cd /d "C:\Ruten Scen New"

:: 1. Fetch latest changes from GitHub silently
git fetch origin main >nul 2>&1

:: 2. Check if local commit differs from remote commit
for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set LOCAL_HEAD=%%a
for /f "tokens=*" %%b in ('git rev-parse @{u} 2^>nul') do set REMOTE_HEAD=%%b

if defined REMOTE_HEAD (
    if not "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
        echo [%date% %time%] New update detected! Pulling from GitHub... >> "%~dp0auto_sync.log"
        git pull origin main >> "%~dp0auto_sync.log" 2>&1
        echo %date% %time% - %REMOTE_HEAD% > "%~dp0update_signal.txt"
        echo [%date% %time%] Updated to %REMOTE_HEAD% >> "%~dp0auto_sync.log"
    )
)
