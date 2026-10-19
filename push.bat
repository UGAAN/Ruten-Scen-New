@echo off
title Ugaan Hub - 1-Click GitHub Push
color 0B
echo ========================================================
echo        UGAAN HUB - 1-CLICK GITHUB CODE PUSH
echo ========================================================
echo.

cd /d "C:\Ruten Scen New"

echo [1/3] Adding changed files...
git add .

echo [2/3] Creating commit...
set msg=Update on %date% at %time%
git commit -m "%msg%"

echo [3/3] Pushing to GitHub (UGAAN/Ruten-Scen-New)...
git push origin main

echo.
if %errorlevel% equ 0 (
    color 0A
    echo ========================================================
    echo    SUCCESS! Badha ferfar GitHub par upload thai gaya!
    echo    Bija PC ma Auto-Update aapo-aap thai jashe.
    echo ========================================================
) else (
    color 0C
    echo ========================================================
    echo    ERROR: Push failed! Check internet connection.
    echo ========================================================
)

echo.
pause
