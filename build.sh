#!/bin/bash
# Linux/Mac 打包脚本
# 用于构建前端和后端为可执行文件

set -e  # 遇到错误立即退出

echo "========================================"
echo "开始打包 Lab 视觉分类系统"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 Python 3.11（优先使用）
if command -v python3.11 &> /dev/null; then
    PYTHON_CMD=python3.11
    echo "使用 Python 3.11 进行打包"
elif command -v python3 &> /dev/null; then
    PYTHON_CMD=python3
    echo "[警告] 使用 python3，建议使用 Python 3.11"
elif command -v python &> /dev/null; then
    PYTHON_CMD=python
    echo "[警告] 使用 python，建议使用 Python 3.11"
else
    echo "[错误] 未找到 Python，请先安装 Python 3.11"
    exit 1
fi

echo "当前 Python 版本:"
$PYTHON_CMD --version
echo ""

# 清理旧的构建文件（保留 spec 文件）
echo "[0/5] 清理旧的构建文件..."
rm -rf dist build src/web/dist
echo "清理完成！（保留 LabClassificationService.spec 配置文件）"
echo ""

echo "[1/5] 构建前端..."
cd src/web
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 前端依赖安装失败"
        cd ../..
        exit 1
    fi
fi
echo "构建前端生产版本..."
npm run build
if [ $? -ne 0 ]; then
    echo "[错误] 前端构建失败"
    cd ../..
    exit 1
fi

# 验证前端构建输出
if [ ! -d "dist" ]; then
    echo "[错误] 前端构建输出目录不存在: src/web/dist"
    cd ../..
    exit 1
fi
if [ ! -f "dist/index.html" ]; then
    echo "[警告] 前端构建输出中未找到 index.html，请检查构建配置"
fi
cd ../..
echo "前端构建完成！输出目录: src/web/dist"
echo ""

echo "[2/5] 检查 Python 依赖..."
if [ -f "requirements.txt" ]; then
    echo "安装 Python 依赖..."
    $PYTHON_CMD -m pip install -r requirements.txt || echo "[警告] Python 依赖安装可能有问题，但继续执行..."
else
    echo "[警告] 未找到 requirements.txt"
fi
echo ""

echo "[3/5] 安装/更新 PyInstaller..."
$PYTHON_CMD -m pip install --upgrade pyinstaller
if [ $? -ne 0 ]; then
    echo "[错误] PyInstaller 安装失败，尝试使用 pip 直接安装..."
    pip install --upgrade pyinstaller
    if [ $? -ne 0 ]; then
        echo "[错误] PyInstaller 安装失败，请检查 Python 环境"
        exit 1
    fi
fi
echo ""

echo "[4/5] 打包后端为可执行文件..."
echo "注意：这个过程可能需要几分钟，请耐心等待..."
echo ""

# 检查后端入口文件
if [ ! -f "src/server/main.py" ]; then
    echo "[错误] 未找到后端入口文件: src/server/main.py"
    exit 1
fi

# 使用 PyInstaller 打包，使用 spec 文件确保所有依赖都被正确打包
if [ -f "LabClassificationService.spec" ]; then
    echo "使用现有的 spec 文件进行打包..."
    $PYTHON_CMD -m PyInstaller --clean LabClassificationService.spec
else
    echo "使用命令行参数进行打包..."
    $PYTHON_CMD -m PyInstaller --name=LabClassificationService \
        --onefile \
        --console \
        --clean \
        --add-data "src/server:src/server" \
        --add-data "src/web/dist:src/web/dist" \
        --hidden-import=uvicorn.lifespan.on \
        --hidden-import=uvicorn.lifespan.off \
        --hidden-import=uvicorn.protocols.websockets.auto \
        --hidden-import=uvicorn.protocols.websockets.websockets_impl \
        --hidden-import=uvicorn.protocols.http.auto \
        --hidden-import=uvicorn.protocols.http.h11_impl \
        --hidden-import=uvicorn.protocols.http.httptools_impl \
        --hidden-import=pydantic \
        --hidden-import=fastapi \
        --hidden-import=starlette \
        --hidden-import=fastapi.applications \
        --hidden-import=fastapi.routing \
        --hidden-import=starlette.applications \
        --hidden-import=starlette.routing \
        --hidden-import=multipart \
        --hidden-import=python_multipart \
        --collect-all=sklearn \
        --collect-all=scipy \
        --collect-all=numpy \
        --collect-all=pandas \
        --collect-all=cv2 \
        --collect-all=PIL \
        src/server/main.py
fi

if [ $? -ne 0 ]; then
    echo "[错误] 打包失败"
    exit 1
fi

echo "[5/5] 验证打包结果..."
if [ ! -f "dist/LabClassificationService" ]; then
    echo "[错误] 可执行文件未生成"
    exit 1
fi

# 获取文件大小
SIZE=$(stat -f%z dist/LabClassificationService 2>/dev/null || stat -c%s dist/LabClassificationService 2>/dev/null || echo "0")
SIZE_MB=$((SIZE / 1048576))
echo "可执行文件大小: ${SIZE_MB} MB"

# 添加执行权限
chmod +x dist/LabClassificationService

echo ""
echo "========================================"
echo "打包完成！"
echo "========================================"
echo ""
echo "可执行文件位置: dist/LabClassificationService"
echo ""
echo "使用方法:"
echo "  1. 将 dist/LabClassificationService 复制到目标位置"
echo "  2. 添加执行权限: chmod +x LabClassificationService"
echo "  3. 运行: ./LabClassificationService"
echo "  4. 在浏览器中访问 http://localhost:8000"
echo ""
echo "注意事项:"
echo "  - 首次运行可能需要几秒钟解压时间"
echo "  - 确保目标机器有必要的运行库"
echo "  - 如果遇到问题，可以在命令行运行查看详细错误信息"
echo ""

