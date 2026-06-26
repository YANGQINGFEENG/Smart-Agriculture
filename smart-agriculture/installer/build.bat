@echo off
chcp 65001 >nul

echo ======================================
echo   TianGong HuiYan - Build Installer
echo ======================================
echo.

echo [1/4] Installing Python dependencies...
pip install customtkinter pillow pyinstaller -i https://pypi.tuna.tsinghua.edu.cn/simple

echo [2/4] Generating icon...
python create_icon.py

echo [3/4] Building installer...
pyinstaller --onefile --windowed --name "TianGongHuiYan-Installer" --icon=icon.ico installer.py

echo [4/4] Done!
echo.
echo Installer: dist\TianGongHuiYan-Installer.exe
echo.

pause
