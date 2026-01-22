@echo off
chcp 65001 >nul 2>&1
REM Windows 打包脚本
REM 用于构建前端和后端为可执行文件

setlocal enabledelayedexpansion

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

REM 检查 Python 3.11
set PYTHON_CMD=python3.11
where python3.11 >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [警告] 未找到 python3.11，尝试使用 python...
    set PYTHON_CMD=python
    where python >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo [错误] 未找到 Python，请先安装 Python 3.11
        pause
        exit /b 1
    )
) else (
    echo 使用 Python 3.11 进行打包
)
echo 当前 Python 版本:
%PYTHON_CMD% --version
echo.

REM 清理旧的构建文件（保留 spec 文件）
echo [0/5] 清理旧的构建文件...
if exist dist rmdir /s /q dist
if exist build rmdir /s /q build
if exist src\web\dist rmdir /s /q src\web\dist
echo 清理完成！（保留 LabClassificationService.spec 配置文件）
echo.

echo [1/5] 构建前端...
cd src\web
echo 检查并安装前端依赖...
call npm install
if !ERRORLEVEL! neq 0 (
    echo [错误] 前端依赖安装失败
    cd ..\..
    pause
    exit /b 1
)
echo 构建前端生产版本...
call npm run build
if !ERRORLEVEL! neq 0 (
    echo [错误] 前端构建失败
    cd ..\..
    pause
    exit /b 1
)

REM 验证前端构建输出
if not exist dist (
    echo [错误] 前端构建输出目录不存在: src\web\dist
    cd ..\..
    pause
    exit /b 1
)
if not exist dist\index.html (
    echo [警告] 前端构建输出中未找到 index.html，请检查构建配置
)
cd ..\..
echo 前端构建完成！输出目录: src\web\dist
echo.

echo [2/5] 检查 Python 依赖...
if not exist requirements.txt (
    echo [警告] 未找到 requirements.txt
) else (
    echo 安装 Python 依赖...
    %PYTHON_CMD% -m pip install -r requirements.txt --quiet
    if !ERRORLEVEL! neq 0 (
        echo [错误] Python 依赖安装失败，请检查 requirements.txt 和 Python 环境
        echo 尝试继续执行，但打包可能会失败...
    ) else (
        echo Python 依赖安装成功
    )
)
echo.

REM 验证关键依赖是否安装
echo 验证关键依赖...
%PYTHON_CMD% -c "import fastapi; import starlette; import uvicorn; print('关键依赖检查通过')" 2>nul
if !ERRORLEVEL! neq 0 (
    echo [错误] 关键依赖（fastapi/starlette/uvicorn）未正确安装
    echo 请手动运行: %PYTHON_CMD% -m pip install fastapi uvicorn starlette
    pause
    exit /b 1
)
echo.

echo [3/5] 安装/更新 PyInstaller...
%PYTHON_CMD% -m pip install --upgrade pyinstaller
if !ERRORLEVEL! neq 0 (
    echo [错误] PyInstaller 安装失败
    echo 尝试使用 pip 直接安装...
    %PYTHON_CMD% -m pip install --upgrade pyinstaller
    if !ERRORLEVEL! neq 0 (
        echo [错误] PyInstaller 安装失败，请检查 Python 环境
        pause
        exit /b 1
    )
)
echo.

echo [4/5] 打包后端为可执行文件...
echo 注意：这个过程可能需要几分钟，请耐心等待...
echo.

REM 检查后端入口文件
if not exist src\server\main.py (
    echo [错误] 未找到后端入口文件: src\server\main.py
    pause
    exit /b 1
)

REM 使用 PyInstaller 打包，使用 spec 文件确保所有依赖都被正确打包
if exist LabClassificationService.spec (
    echo 使用现有的 spec 文件进行打包...
    %PYTHON_CMD% -m PyInstaller --clean LabClassificationService.spec
) else (
    echo 使用命令行参数进行打包...
    %PYTHON_CMD% -m PyInstaller --name=LabClassificationService ^
        --onefile ^
        --console ^
        --clean ^
        --add-data "src/server;src/server" ^
        --add-data "src/web/dist;src/web/dist" ^
        --hidden-import=uvicorn.lifespan.on ^
        --hidden-import=uvicorn.lifespan.off ^
        --hidden-import=uvicorn.protocols.websockets.auto ^
        --hidden-import=uvicorn.protocols.websockets.websockets_impl ^
        --hidden-import=uvicorn.protocols.http.auto ^
        --hidden-import=uvicorn.protocols.http.h11_impl ^
        --hidden-import=uvicorn.protocols.http.httptools_impl ^
        --hidden-import=pydantic ^
        --hidden-import=fastapi ^
        --hidden-import=starlette ^
        --hidden-import=fastapi.applications ^
        --hidden-import=fastapi.routing ^
        --hidden-import=starlette.applications ^
        --hidden-import=starlette.routing ^
        --hidden-import=multipart ^
        --hidden-import=python_multipart ^
        --collect-all=sklearn ^
        --collect-all=scipy ^
        --collect-all=numpy ^
        --collect-all=pandas ^
        --collect-all=cv2 ^
        --collect-all=PIL ^
        src/server/main.py
)

if !ERRORLEVEL! neq 0 (
    echo [错误] 打包失败
    pause
    exit /b 1
)

echo [5/5] 验证打包结果...
if not exist dist\LabClassificationService.exe (
    echo [错误] 可执行文件未生成
    pause
    exit /b 1
)

REM 获取文件大小
for %%A in (dist\LabClassificationService.exe) do set SIZE=%%~zA
set /a SIZE_MB=!SIZE!/1048576
echo 可执行文件大小: !SIZE_MB! MB

echo.
echo ========================================
echo 打包完成！
echo ========================================
echo.
echo 可执行文件位置: dist\LabClassificationService.exe
echo.
echo 使用方法:
echo   1. 将 dist\LabClassificationService.exe 复制到目标位置
echo   2. 双击运行即可启动服务（或命令行运行）
echo   3. 在浏览器中访问 http://localhost:8000
echo.
echo 注意事项:
echo   - 首次运行可能需要几秒钟解压时间
echo   - 确保目标机器有必要的运行库（如 Visual C++ Redistributable）
echo   - 如果遇到问题，可以在命令行运行查看详细错误信息
echo.
pause

