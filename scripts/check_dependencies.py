"""
检查打包后的 exe 文件的系统依赖
用于验证是否需要 Visual C++ 运行时等系统库
"""

import os
import sys
import subprocess
from pathlib import Path

def check_opencv_dependencies():
    """检查 OpenCV 的依赖"""
    try:
        import cv2
        print(f"OpenCV 版本: {cv2.__version__}")
        print(f"OpenCV 路径: {cv2.__file__}")
        
        # 检查 OpenCV 的 DLL 文件
        opencv_dir = os.path.dirname(cv2.__file__)
        dll_files = list(Path(opencv_dir).glob("*.dll"))
        
        if dll_files:
            print(f"\n找到 {len(dll_files)} 个 DLL 文件:")
            for dll in dll_files[:10]:  # 只显示前10个
                print(f"  - {dll.name}")
            if len(dll_files) > 10:
                print(f"  ... 还有 {len(dll_files) - 10} 个")
        
        return True
    except ImportError as e:
        print(f"无法导入 OpenCV: {e}")
        return False

def check_system_dlls():
    """检查可能需要的系统 DLL"""
    critical_dlls = [
        "MSVCR120.dll",  # Visual C++ 2013
        "MSVCR140.dll",  # Visual C++ 2015-2019
        "VCRUNTIME140.dll",  # Visual C++ 2015-2022
        "VCRUNTIME140_1.dll",  # Visual C++ 2015-2022 (新版本)
        "MSVCP140.dll",  # Visual C++ 2015-2022
        "api-ms-win-crt-runtime-l1-1-0.dll",  # Universal C Runtime
    ]
    
    print("\n检查系统 DLL 依赖:")
    found = []
    missing = []
    
    # 检查系统目录
    system_dirs = [
        os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "System32"),
        os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "SysWOW64"),
    ]
    
    for dll in critical_dlls:
        found_in_system = False
        for sys_dir in system_dirs:
            dll_path = os.path.join(sys_dir, dll)
            if os.path.exists(dll_path):
                found.append((dll, dll_path))
                found_in_system = True
                break
        
        if not found_in_system:
            missing.append(dll)
    
    if found:
        print("\n✅ 已找到的系统 DLL:")
        for dll, path in found:
            print(f"  {dll} -> {path}")
    
    if missing:
        print("\n⚠️  未找到的系统 DLL (可能需要安装 Visual C++ Redistributable):")
        for dll in missing:
            print(f"  {dll}")
        print("\n建议安装: Visual C++ Redistributable for Visual Studio 2015-2022")
        print("下载地址: https://aka.ms/vs/17/release/vc_redist.x64.exe")
    else:
        print("\n✅ 所有关键系统 DLL 都已找到")
    
    return len(missing) == 0

def check_python_packages():
    """检查 Python 包的依赖"""
    print("\n检查关键 Python 包的依赖:")
    
    packages = {
        "cv2": "opencv-python",
        "numpy": "numpy",
        "sklearn": "scikit-learn",
        "scipy": "scipy",
        "skimage": "scikit-image",
    }
    
    for module, package in packages.items():
        try:
            mod = __import__(module)
            version = getattr(mod, "__version__", "未知")
            print(f"  ✅ {package}: {version}")
        except ImportError:
            print(f"  ❌ {package}: 未安装")

if __name__ == "__main__":
    print("=" * 60)
    print("系统依赖检查工具")
    print("=" * 60)
    
    print(f"\nPython 版本: {sys.version}")
    print(f"Python 路径: {sys.executable}")
    
    # 检查是否为打包环境
    is_packaged = getattr(sys, 'frozen', False)
    if is_packaged:
        print(f"\n📦 打包环境检测:")
        print(f"  可执行文件: {sys.executable}")
        if hasattr(sys, '_MEIPASS'):
            print(f"  临时解压目录: {sys._MEIPASS}")
    else:
        print("\n🔧 开发环境")
    
    # 检查 OpenCV
    print("\n" + "=" * 60)
    check_opencv_dependencies()
    
    # 检查系统 DLL
    print("\n" + "=" * 60)
    all_dlls_found = check_system_dlls()
    
    # 检查 Python 包
    print("\n" + "=" * 60)
    check_python_packages()
    
    print("\n" + "=" * 60)
    if all_dlls_found:
        print("✅ 系统依赖检查通过！")
    else:
        print("⚠️  可能需要安装 Visual C++ Redistributable")
    print("=" * 60)

