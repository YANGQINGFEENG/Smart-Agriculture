@echo off

REM 简单的项目编译脚本
REM 直接调用Keil MDK的命令行工具

REM 定义Keil MDK路径和项目文件
set UV4_PATH=E:\keil_v5\UV4\UV4.exe
set PROJECT_FILE=Project.uvprojx

REM 检查Keil MDK是否存在
if not exist "%UV4_PATH%" (
    echo 错误: 未找到Keil MDK工具
    echo 路径: %UV4_PATH%
    pause
    exit /b 1
)

REM 检查项目文件是否存在
if not exist "%PROJECT_FILE%" (
    echo 错误: 未找到项目文件
    echo 文件名: %PROJECT_FILE%
    pause
    exit /b 1
)

REM 显示编译信息
echo ======================================
echo 开始编译项目...
echo 项目文件: %PROJECT_FILE%
echo Keil MDK路径: %UV4_PATH%
echo 编译时间: %date% %time%
echo ======================================

REM 执行编译命令
"%UV4_PATH%" -b "%PROJECT_FILE%"

REM 检查编译结果
if %errorlevel% equ 0 (
    echo ======================================
    echo 编译成功！
    echo 编译时间: %date% %time%
    echo 编译结果文件: Objects\Project.axf
    echo ======================================
) else (
    echo ======================================
    echo 编译失败！
    echo 错误代码: %errorlevel%
    echo 请检查编译日志获取详细信息
    echo ======================================
)

REM 显示编译日志（如果存在）
if exist "build_log.txt" (
    echo 编译日志:
    powershell -Command "Get-Content 'build_log.txt' | Select-Object -Last 20"
)

pause
