@echo off
chcp 65001 >nul

echo ======================================
echo   天工慧眼 - 构建安装程序
echo ======================================
echo.

:: 安装依赖
echo [1/4] 安装Python依赖...
pip install customtkinter pillow pyinstaller -i https://pypi.tuna.tsinghua.edu.cn/simple

echo [2/4] 生成图标...
python create_icon.py

echo [3/4] 构建安装程序...
pyinstaller --onefile --windowed --name "天工慧眼-安装程序" --icon=icon.ico installer.py

echo [4/4] 复制资源...
if not exist "dist\resources" mkdir "dist\resources"
copy *.md "dist\resources\" >nul 2>&1

echo.
echo ======================================
echo   构建完成！
echo ======================================
echo.
echo 安装程序: dist\天工慧眼-安装程序.exe
echo.
echo 将此文件分发给用户即可。
echo.

pause
