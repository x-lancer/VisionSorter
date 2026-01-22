# -*- mode: python ; coding: utf-8 -*-
import os
from PyInstaller.utils.hooks import collect_all, collect_submodules

datas = [('src/server', 'src/server'), ('src/web/dist', 'src/web/dist')]
binaries = []
hiddenimports = [
    # uvicorn
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    # FastAPI 核心
    'fastapi',
    'fastapi.applications',
    'fastapi.routing',
    'fastapi.middleware',
    'fastapi.middleware.cors',
    'fastapi.responses',
    'fastapi.exceptions',
    # Starlette
    'starlette',
    'starlette.applications',
    'starlette.routing',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.responses',
    'starlette.requests',
    # Pydantic
    'pydantic',
    'pydantic.fields',
    'pydantic.validators',
    'pydantic.types',
    'pydantic_core',
    # 其他常用模块
    'multipart',
    'python_multipart',
    'anyio',
    'sniffio',
    'h11',
    'idna',
]

# 收集所有子模块
for module in ['fastapi', 'starlette', 'pydantic', 'uvicorn']:
    try:
        hiddenimports += collect_submodules(module)
    except:
        pass

# 使用 collect_all 收集 FastAPI 和 Starlette（确保所有文件都被包含）
# 添加错误处理，防止模块不存在时崩溃
for module_name in ['fastapi', 'starlette', 'pydantic', 'uvicorn']:
    try:
        tmp_ret = collect_all(module_name)
        datas += tmp_ret[0]
        binaries += tmp_ret[1]
        hiddenimports += tmp_ret[2]
    except Exception as e:
        print(f"警告: 无法收集模块 {module_name}: {e}")
        # 即使收集失败，也添加基本导入
        hiddenimports.append(module_name)

# 收集大型库的所有内容（添加错误处理）
for module_name in ['sklearn', 'scipy', 'numpy', 'pandas', 'cv2', 'PIL']:
    try:
        tmp_ret = collect_all(module_name)
        datas += tmp_ret[0]
        binaries += tmp_ret[1]
        hiddenimports += tmp_ret[2]
    except Exception as e:
        print(f"警告: 无法收集模块 {module_name}: {e}")
        hiddenimports.append(module_name)

a = Analysis(
    [os.path.join('src', 'server', 'main.py')],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='LabClassificationService',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
