@echo off
cd /d "%~dp0"

:: 1. Check if git exists
where git >nul 2>&1
if %errorlevel% neq 0 exit /b

:: 2. Ensure remote is correct
git remote set-url origin https://github.com/UGAAN/Ruten-Scen-New.git 2>nul
if %errorlevel% neq 0 git remote add origin https://github.com/UGAAN/Ruten-Scen-New.git 2>nul

:: 3. Fetch latest changes from GitHub silently
git -c http.sslVerify=false fetch origin main >nul 2>&1
if %errorlevel% neq 0 exit /b

:: 4. Check if local commit differs from origin/main
for /f "tokens=*" %%a in ('git rev-parse HEAD 2^>nul') do set LOCAL_HEAD=%%a
for /f "tokens=*" %%b in ('git rev-parse origin/main 2^>nul') do set REMOTE_HEAD=%%b

if defined REMOTE_HEAD (
    if not "%LOCAL_HEAD%"=="%REMOTE_HEAD%" (
        echo [%date% %time%] New update detected! Resetting to origin/main... >> "%~dp0auto_sync.log"
        git checkout -B main origin/main >> "%~dp0auto_sync.log" 2>&1
        git reset --hard origin/main >> "%~dp0auto_sync.log" 2>&1
        echo %date% %time% - %REMOTE_HEAD% > "%~dp0update_signal.txt"
        echo [%date% %time%] Updated to %REMOTE_HEAD% >> "%~dp0auto_sync.log"
    )
)
