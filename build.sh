#!/bin/bash
# Linux/Mac 打包脚本
# 用于构建前端和后端

echo "========================================"
echo "开始打包 Lab 视觉分类系统"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 Python
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "[错误] 未找到 Python，请先安装 Python"
    exit 1
fi

PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null)

echo "[1/4] 构建前端..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    npm install
fi
echo "构建前端生产版本..."
npm run build
if [ $? -ne 0 ]; then
    echo "[错误] 前端构建失败"
    cd ..
    exit 1
fi
cd ..
echo "前端构建完成！"
echo ""

echo "[2/4] 检查 Python 依赖..."
if [ -f "requirements.txt" ]; then
    $PYTHON_CMD -m pip install -r requirements.txt
else
    echo "[警告] 未找到 requirements.txt"
fi
echo ""

echo "[3/4] 安装 PyInstaller..."
$PYTHON_CMD -m pip install pyinstaller
echo ""

echo "[4/4] 打包后端为可执行文件..."
echo "注意：这个过程可能需要几分钟，请耐心等待..."
echo ""

$PYTHON_CMD -m PyInstaller --name=LabClassificationService \
    --onefile \
    --console \
    --add-data "service:service" \
    --add-data "frontend/dist:frontend/dist" \
    --hidden-import=uvicorn.lifespan.on \
    --hidden-import=uvicorn.lifespan.off \
    --hidden-import=uvicorn.protocols.websockets.auto \
    --hidden-import=uvicorn.protocols.websockets.websockets_impl \
    --hidden-import=uvicorn.protocols.http.auto \
    --hidden-import=uvicorn.protocols.http.h11_impl \
    --hidden-import=uvicorn.protocols.http.httptools_impl \
    --collect-all=sklearn \
    --collect-all=scipy \
    service/lab_service.py

if [ $? -ne 0 ]; then
    echo "[错误] 打包失败"
    exit 1
fi

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

