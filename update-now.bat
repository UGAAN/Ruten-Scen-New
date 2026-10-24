@echo off
title Ugaan Hub - 1-Click System Updater (v2.0.4)
color 0B
echo ========================================================
echo          UGAAN HUB - 1-CLICK SYSTEM UPDATER
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Git and Repository...
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Git is not installed on this PC.
    goto DOWNLOAD_FALLBACK
)

if not exist "%~dp0.git" (
    echo [INFO] .git folder not found. Initializing Git repository...
    git init
    git remote add origin https://github.com/UGAAN/Ruten-Scen-New.git 2>nul
)

echo [INFO] Ensuring remote origin is set...
git remote set-url origin https://github.com/UGAAN/Ruten-Scen-New.git 2>nul
if %errorlevel% neq 0 (
    git remote add origin https://github.com/UGAAN/Ruten-Scen-New.git 2>nul
)

echo [2/3] Fetching latest files from GitHub...
git -c http.sslVerify=false fetch origin main
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Git fetch failed! Trying PowerShell direct download...
    goto DOWNLOAD_FALLBACK
)

echo [INFO] Applying updates to local files...
git checkout -B main origin/main
git reset --hard origin/main
goto UPDATE_SUCCESS

:DOWNLOAD_FALLBACK
echo.
echo [2/3] Downloading latest repository zip directly from GitHub...
powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $zip = Join-Path $env:TEMP 'ruten_update.zip'; $ext = Join-Path $env:TEMP 'ruten_update_ext'; if (Test-Path $zip) { Remove-Item $zip -Force }; if (Test-Path $ext) { Remove-Item $ext -Recurse -Force }; Invoke-WebRequest -Uri 'https://github.com/UGAAN/Ruten-Scen-New/archive/refs/heads/main.zip' -OutFile $zip; Expand-Archive -Path $zip -DestinationPath $ext -Force; Copy-Item -Path (Join-Path $ext 'Ruten-Scen-New-main\*') -Destination (Get-Location).Path -Recurse -Force; Remove-Item $zip -Force; Remove-Item $ext -Recurse -Force"
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ========================================================
    echo  ERROR: Could not download update! Check internet connection.
    echo ========================================================
    pause
    exit /b 1
)

:UPDATE_SUCCESS
echo.
echo [3/3] Current Installed Version:
findstr /i "\"version\"" "%~dp0manifest.json"

echo.
color 0A
echo ========================================================
echo    SUCCESS! Badha nava ferfar hard disk par aavi gaya!
echo ========================================================
echo.
echo    HAVE KHALI AA 2 STEP KARO:
echo    1. Brave / Chrome ma "Extensions" tab par jaao (chrome://extensions).
echo    2. "Ugaan Hub" extension par [Reload] (Gol circle icon) dabavo.
echo    3. Flipkart VMS tab refresh karo.
echo ========================================================
echo.
pause
