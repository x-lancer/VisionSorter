# 解决 numpy.core.multiarray 导入错误

## 错误原因

`ImportError: numpy.core.multiarray failed to import` 通常由以下原因引起：

1. **numpy 版本过旧或过新**，与 opencv-python 或其他依赖不兼容
2. **numpy 安装损坏**或不完整
3. **Python 版本与 numpy 不匹配**

## 解决方案

### 方案1：重新安装 numpy 和 opencv-python（推荐）

```bash
# 卸载旧版本
pip uninstall numpy opencv-python -y

# 清理缓存
pip cache purge

# 重新安装兼容版本
pip install "numpy>=1.24.0,<2.0.0"
pip install opencv-python>=4.8.0
```

### 方案2：使用 requirements.txt 安装所有依赖

```bash
cd service
pip install -r requirements.txt
```

### 方案3：升级 Python 和所有包

```bash
# 如果使用 Python 3.11+
python -m pip install --upgrade pip
pip install --upgrade numpy opencv-python scikit-image
```

### 方案4：检查并修复环境

```bash
# 检查 Python 版本（推荐 3.9-3.11）
python --version

# 检查已安装的包版本
pip list | grep -E "(numpy|opencv)"

# 如果有冲突，强制重新安装
pip install --force-reinstall --no-cache-dir numpy opencv-python
```

## 推荐版本组合

### Python 3.9
- numpy: 1.24.0 - 1.26.4
- opencv-python: 4.8.0+

### Python 3.10
- numpy: 1.24.0 - 1.26.4
- opencv-python: 4.8.0+

### Python 3.11
- numpy: 1.24.0 - 1.26.4
- opencv-python: 4.8.0+

## 验证安装

安装完成后，运行以下命令验证：

```python
python -c "import numpy; print(f'numpy: {numpy.__version__}')"
python -c "import cv2; print(f'opencv: {cv2.__version__}')"
python -c "from skimage.color import rgb2lab; print('skimage: OK')"
```

## 如果问题仍然存在

1. **检查虚拟环境**：确保在正确的虚拟环境中安装
2. **重新创建虚拟环境**：
   ```bash
   # 删除旧环境
   rm -rf venv  # Linux/Mac
   rmdir /s venv  # Windows
   
   # 创建新环境
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   venv\Scripts\activate  # Windows
   
   # 安装依赖
   pip install -r requirements.txt
   ```

3. **检查系统依赖**（Linux）：
   ```bash
   # Ubuntu/Debian
   sudo apt-get install python3-dev libopencv-dev
   ```

