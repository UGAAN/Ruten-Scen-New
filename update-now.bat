@echo off
title Ugaan Hub - 1-Click System Updater
color 0B
echo ========================================================
echo          UGAAN HUB - 1-CLICK SYSTEM UPDATER
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Checking environment...
where git >nul 2>&1
if %errorlevel% equ 0 (
    echo Git detected. Fetching latest version from GitHub...
    git fetch origin main
    if %errorlevel% neq 0 (
        echo [WARNING] Git fetch failed! Attempting direct download fallback...
        goto DOWNLOAD_FALLBACK
    )
    echo [2/3] Updating local files...
    git reset --hard origin/main
    if %errorlevel% neq 0 (
        echo [WARNING] Git reset failed! Attempting direct download fallback...
        goto DOWNLOAD_FALLBACK
    )
    goto UPDATE_SUCCESS
) else (
    echo Git is NOT installed. Using PowerShell direct updater...
    goto DOWNLOAD_FALLBACK
)

:DOWNLOAD_FALLBACK
echo.
echo [2/3] Downloading latest repository zip from GitHub...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/UGAAN/Ruten-Scen-New/archive/refs/heads/main.zip' -OutFile '%temp%\ruten_update.zip'"
if %errorlevel% neq 0 (
    color 0C
    echo ========================================================
    echo  ERROR: Internet issue! Could not download from GitHub.
    echo ========================================================
    pause
    exit /b 1
)

echo Extracting updated files...
powershell -Command "Expand-Archive -Path '%temp%\ruten_update.zip' -DestinationPath '%temp%\ruten_update_ext' -Force; Copy-Item -Path '%temp%\ruten_update_ext\Ruten-Scen-New-main\*' -Destination '%~dp0' -Recurse -Force; Remove-Item '%temp%\ruten_update.zip' -Force; Remove-Item '%temp%\ruten_update_ext' -Recurse -Force"

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
echo    3. Flipkart VMS tab refresh karo. "UPDATE READY" button jato raheshe!
echo ========================================================
echo.
pause
