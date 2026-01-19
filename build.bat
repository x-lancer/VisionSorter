@echo off
chcp 65001 >nul 2>&1
REM Windows 打包脚本
REM 用于构建前端和后端

echo ========================================
echo 开始打包 Lab 视觉分类系统
echo ========================================
echo.

REM 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 Python
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [错误] 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

echo [1/4] 构建前端...
cd frontend
if not exist node_modules (
    echo 安装前端依赖...
    call npm install
)
echo 构建前端生产版本...
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [错误] 前端构建失败
    cd ..
    pause
    exit /b 1
)
cd ..
echo 前端构建完成！
echo.

echo [2/4] 检查 Python 依赖...
if not exist requirements.txt (
    echo [警告] 未找到 requirements.txt
) else (
    pip install -r requirements.txt
)
echo.

echo [3/4] 安装 PyInstaller...
pip install pyinstaller
echo.

echo [4/4] 打包后端为可执行文件...
echo 注意：这个过程可能需要几分钟，请耐心等待...
echo.

pyinstaller --name=LabClassificationService ^
    --onefile ^
    --console ^
    --add-data "service;service" ^
    --add-data "frontend/dist;frontend/dist" ^
    --hidden-import=uvicorn.lifespan.on ^
    --hidden-import=uvicorn.lifespan.off ^
    --hidden-import=uvicorn.protocols.websockets.auto ^
    --hidden-import=uvicorn.protocols.websockets.websockets_impl ^
    --hidden-import=uvicorn.protocols.http.auto ^
    --hidden-import=uvicorn.protocols.http.h11_impl ^
    --hidden-import=uvicorn.protocols.http.httptools_impl ^
    --collect-all=sklearn ^
    --collect-all=scipy ^
    service/lab_service.py

if %ERRORLEVEL% neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo 打包完成！
echo ========================================
echo.
echo 可执行文件位置: dist\LabClassificationService.exe
echo.
echo 使用方法:
echo   1. 将 dist\LabClassificationService.exe 复制到目标位置
echo   2. 双击运行即可启动服务
echo   3. 在浏览器中访问 http://localhost:8000
echo.
pause

