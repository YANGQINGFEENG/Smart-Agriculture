@echo off

REM 编译脚本 - 用于自动化编译Keil MDK项目
REM 作者：STM32开发团队
REM 日期：2026-02-05

REM 定义Keil MDK路径
set UV4_PATH="D:\Program Files\UV4\uv4.exe"

REM 定义项目文件路径
set PROJECT_FILE="Project.uvprojx"

REM 检查uv4.exe是否存在
if not exist %UV4_PATH% (
    echo 错误：未找到uv4.exe工具
    echo 请确保Keil MDK已正确安装在 D:\Program Files\UV4\ 目录中
    pause
    exit /b 1
)

REM 检查项目文件是否存在
if not exist %PROJECT_FILE% (
    echo 错误：未找到项目文件 %PROJECT_FILE%
    echo 请确保脚本在正确的项目目录中运行
    pause
    exit /b 1
)

REM 显示编译信息
echo ======================================
echo 开始编译项目...
echo 项目文件：%PROJECT_FILE%
echo Keil MDK路径：%UV4_PATH%
echo 编译时间：%date% %time%
echo ======================================

REM 执行编译命令
%UV4_PATH% -b %PROJECT_FILE%

REM 检查编译结果
if %errorlevel% equ 0 (
    echo ======================================
    echo 编译成功！
    echo 编译时间：%date% %time%
    echo 编译结果文件：Objects\Project.axf
    echo ======================================
    pause
    exit /b 0
) else (
    echo ======================================
    echo 编译失败！
    echo 错误代码：%errorlevel%
    echo 请检查编译日志获取详细信息
    echo ======================================
    pause
    exit /b 1
)
