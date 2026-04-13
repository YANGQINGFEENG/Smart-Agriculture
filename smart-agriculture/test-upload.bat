@echo off
chcp 65001 >nul
echo ========================================
echo 智慧农业物联网平台 - 数据上传测试
echo ========================================
echo.

echo [1/2] 启动数据上传脚本...
start "数据上传测试" cmd /k "cd /d %~dp0 && npx tsx scripts/upload-test-data.ts"

echo [2/2] 打开浏览器查看数据...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ✅ 测试已启动！
echo 📊 数据上传窗口已打开
echo 🌐 浏览器已打开 http://localhost:3000
echo.
echo 💡 提示：
echo    - 数据将每5秒上传一次
echo    - 共上传10次后自动停止
echo    - 按 Ctrl+C 可手动停止
echo.
pause
