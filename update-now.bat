@echo off
title Ugaan Hub - Update to Version 2.0.1
color 0B
echo ========================================================
echo          UGAAN HUB - UPDATING TO VERSION 2.0.1
echo ========================================================
echo.

cd /d "C:\Ruten Scen New"

echo [1/3] Fetching latest version from GitHub...
git fetch origin main

echo [2/3] Updating local files...
git reset --hard origin/main

echo.
echo [3/3] Installed Version:
type manifest.json | findstr "version"

echo.
echo ========================================================
echo    SUCCESS! Nava ferfar (v2.0.1) aavi gaya che!
echo    Have Chrome ma chrome://extensions par Reload karo.
echo ========================================================
echo.
pause
