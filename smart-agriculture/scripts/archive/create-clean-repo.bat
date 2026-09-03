@echo off
chcp 65001 >nul

echo ======================================
echo   Creating Clean Repository
echo ======================================
echo.

set NEW_REPO=E:\tghy-clean
set SOURCE=E:\tghy\smart-agriculture

echo [1/5] Creating clean directory...
if exist "%NEW_REPO%" rmdir /S /Q "%NEW_REPO%"
mkdir "%NEW_REPO%"

echo [2/5] Copying smart-agriculture project...
xcopy "%SOURCE%\*" "%NEW_REPO%\smart-agriculture\" /E /I /H /Y /Q

echo [3/5] Removing unnecessary files...
cd /d "%NEW_REPO%\smart-agriculture"

:: Remove build artifacts
rmdir /S /Q node_modules 2>nul
rmdir /S /Q .next 2>nul
rmdir /S /Q dist 2>nul
rmdir /S /Q build 2>nul

:: Remove database files
del /F *.db 2>nul
del /F *.db-journal 2>nul

:: Remove environment files (keep example)
del /F .env.local 2>nul

:: Remove installer build artifacts
rmdir /S /Q installer\dist 2>nul
rmdir /S /Q installer\build 2>nul
del /F installer\*.spec 2>nul

:: Remove Python virtual environment
rmdir /S /Q inference-service\venv 2>nul

echo [4/5] Initializing git repository...
cd /d "%NEW_REPO%"
git init
git add .
git commit -m "feat: initial commit - TianGong HuiYan Smart Agriculture Platform"

echo [5/5] Done!
echo.
echo ======================================
echo   Clean repository created at:
echo   %NEW_REPO%
echo ======================================
echo.
echo Next steps:
echo   1. Create new repository on GitHub
echo   2. Run: git remote add origin ^<url^>
echo   3. Run: git push -u origin main
echo.

pause
