"""
LAB颜色值计算服务API
提供HTTP接口，接收图片，计算中心区域的LAB值
支持并发处理
"""

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel
import os
import glob
from utils.imgtool import bgr_to_lab, extract_center_region, extract_lab_from_mask
from utils.color_clustering import (
    cluster_images_by_color_de2000,
    calculate_inter_cluster_distance
)
from utils.db import init_db, insert_cluster_result
import json


app = FastAPI(
    title="LAB颜色值计算服务",
    description="接收图片，计算中心区域的LAB颜色值，支持颜色聚类",
    version="1.0.0"
)

# 初始化 SQLite 数据库（如果不存在则创建）
init_db()

# 配置CORS，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该指定具体的前端地址
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 尝试挂载前端静态文件
_frontend_dist_path = None

# 尝试多个可能的前端路径
import sys

# 检测是否为 PyInstaller 打包环境
if getattr(sys, 'frozen', False):
    # 打包环境：PyInstaller 会将数据文件解压到临时目录
    base_path = sys._MEIPASS if hasattr(sys, '_MEIPASS') else os.path.dirname(sys.executable)
    _possible_frontend_paths = [
        os.path.join(base_path, "src", "web", "dist"),
        os.path.join(base_path, "web", "dist"),
        os.path.join(os.path.dirname(sys.executable), "src", "web", "dist"),
        os.path.join(os.path.dirname(sys.executable), "web", "dist"),
    ]
else:
    # 开发环境
    _possible_frontend_paths = [
        os.path.join(os.path.dirname(__file__), "..", "web", "dist"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "dist"),
        "src/web/dist",
        "web/dist",
    ]

# 查找前端文件
for path in _possible_frontend_paths:
    abs_path = os.path.abspath(path) if not os.path.isabs(path) else path
    if os.path.exists(abs_path) and os.path.isdir(abs_path):
        index_file = os.path.join(abs_path, "index.html")
        if os.path.exists(index_file):
            _frontend_dist_path = abs_path
            print(f"[INFO] 找到前端静态文件目录: {_frontend_dist_path}")
            break

if _frontend_dist_path:
    # 挂载静态资源目录（assets）
    assets_path = os.path.join(_frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="static_assets")
    # 挂载其他静态资源（如 favicon.ico 等）
    try:
        app.mount("/static", StaticFiles(directory=_frontend_dist_path), name="static")
    except:
        pass


class LABResponse(BaseModel):
    """LAB值响应模型"""
    L: float
    a: float
    b: float
    lab_vector: list[float]
    center_ratio: float
    success: bool
    message: Optional[str] = None


def calculate_center_lab(
    image: np.ndarray,
    center_ratio: float = 0.4,
    use_median: bool = True
) -> tuple[np.ndarray, float]:
    """
    计算图片中心区域的LAB值
    
    参数:
        image: BGR格式的OpenCV图像
        center_ratio: 中心区域半径比例，默认0.4（即40%）
        use_median: 是否使用中值（抗高光），默认True
    
    返回:
        lab_vector: [L, a, b] 三个值的numpy数组
        center_ratio: 实际使用的中心区域比例
    """
    h, w = image.shape[:2]
    
    # 创建全图mask
    mask = np.ones((h, w), dtype=np.uint8) * 255
    
    # 提取中心区域
    center_mask = extract_center_region(mask, ratio=center_ratio)
    
    # 转换为LAB颜色空间
    lab_image = bgr_to_lab(image)
    
    # 从中心区域提取LAB向量
    lab_vector = extract_lab_from_mask(lab_image, center_mask, use_median=use_median)
    
    return lab_vector, center_ratio


@app.get("/")
async def root():
    """根路径，返回前端页面或API信息"""
    if _frontend_dist_path:
        index_path = os.path.join(_frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        else:
            print(f"[WARN] 前端 index.html 不存在: {index_path}")
    else:
        print("[WARN] 未找到前端目录，尝试的路径:")
        for path in _possible_frontend_paths:
            abs_path = os.path.abspath(path) if not os.path.isabs(path) else path
            exists = os.path.exists(abs_path)
            print(f"  - {abs_path}: {'存在' if exists else '不存在'}")
    
    # 如果前端文件不存在，返回API信息
    return {
        "service": "LAB颜色值计算服务",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/calculate-lab": "计算图片中心区域的LAB值",
            "GET /docs": "API文档"
        },
        "note": f"前端文件未找到。搜索路径: {_possible_frontend_paths if '_possible_frontend_paths' in locals() else 'N/A'}"
    }


@app.post("/api/calculate-lab", response_model=LABResponse)
async def calculate_lab(
    image: UploadFile = File(..., description="上传的图片文件（支持jpg、png等格式）"),
    center_ratio: float = 0.4,
    use_median: bool = True
):
    """
    计算图片中心区域的LAB颜色值
    
    参数:
        image: 上传的图片文件
        center_ratio: 中心区域半径比例（0-1），默认0.4（即40%）
        use_median: 是否使用中值计算（抗高光），默认True
    
    返回:
        LABResponse: 包含L、a、b值的JSON响应
    """
    try:
        # 验证中心区域比例
        if not 0 < center_ratio <= 1.0:
            raise HTTPException(
                status_code=400,
                detail="center_ratio必须在(0, 1]范围内"
            )
        
        # 读取图片数据
        image_bytes = await image.read()
        
        # 转换为numpy数组
        nparr = np.frombuffer(image_bytes, np.uint8)
        
        # 解码图片
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(
                status_code=400,
                detail="无法解码图片，请确保上传的是有效的图片文件"
            )
        
        # 计算中心区域LAB值
        lab_vector, actual_ratio = calculate_center_lab(
            img,
            center_ratio=center_ratio,
            use_median=use_median
        )
        
        # 构建响应
        response = LABResponse(
            L=float(lab_vector[0]),
            a=float(lab_vector[1]),
            b=float(lab_vector[2]),
            lab_vector=[float(lab_vector[0]), float(lab_vector[1]), float(lab_vector[2])],
            center_ratio=actual_ratio,
            success=True,
            message="计算成功"
        )
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"计算LAB值时发生错误: {str(e)}"
        )


@app.post("/api/calculate-lab-batch", response_model=dict)
async def calculate_lab_batch(
    images: list[UploadFile] = File(..., description="批量上传的图片文件列表"),
    center_ratio: float = 0.4,
    use_median: bool = True
):
    """
    批量计算多张图片的中心区域LAB值
    
    参数:
        images: 上传的图片文件列表
        center_ratio: 中心区域半径比例，默认0.4
        use_median: 是否使用中值计算，默认True
    
    返回:
        包含每张图片LAB值的字典列表
    """
    results = []
    
    for idx, image in enumerate(images):
        try:
            # 计算单张图片的LAB值
            response = await calculate_lab(
                image=image,
                center_ratio=center_ratio,
                use_median=use_median
            )
            results.append({
                "index": idx,
                "filename": image.filename,
                "lab": {
                    "L": response.L,
                    "a": response.a,
                    "b": response.b
                },
                "success": True
            })
        except Exception as e:
            results.append({
                "index": idx,
                "filename": image.filename if image.filename else f"image_{idx}",
                "error": str(e),
                "success": False
            })
    
    return {
        "total": len(images),
        "success_count": sum(1 for r in results if r.get("success", False)),
        "results": results
    }


# ============================================================================
# 颜色聚类API
# ============================================================================

class ClusterRequest(BaseModel):
    """聚类请求模型"""
    image_dir: str  # 图片目录路径
    n_clusters: int  # 聚类数量
    center_ratio: float = 0.4  # 中心区域比例


class ImageInfo(BaseModel):
    """图片信息模型"""
    path: str
    filename: str
    lab: dict  # {"L": float, "a": float, "b": float}
    cluster_id: Optional[int] = None


def extract_lab_from_image(image_path: str, center_ratio: float = 0.4) -> np.ndarray:
    """从图片中提取中心区域的LAB值"""
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    h, w = img.shape[:2]
    mask = np.ones((h, w), dtype=np.uint8) * 255
    center_mask = extract_center_region(mask, ratio=center_ratio)
    lab_image = bgr_to_lab(img)
    lab_vector = extract_lab_from_mask(lab_image, center_mask, use_median=True)
    
    return lab_vector


class FolderPathRequest(BaseModel):
    """文件夹路径解析请求模型"""
    file_paths: List[str]  # 文件路径列表（相对路径或完整路径）


@app.get("/api/image")
async def get_image(path: str = Query(..., description="图片文件的完整路径")):
    """
    获取本地图片文件（用于显示缩略图）
    
    参数:
        path: 图片文件的完整路径（URL 编码）
    
    返回:
        图片文件响应
    """
    try:
        # URL 解码路径
        import urllib.parse
        image_path = urllib.parse.unquote(path)
        
        # 检查文件是否存在
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail=f"图片文件不存在: {image_path}")
        
        # 检查是否是图片文件
        image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.gif']
        if not any(image_path.lower().endswith(ext) for ext in image_extensions):
            raise HTTPException(status_code=400, detail="不支持的文件类型")
        
        # 返回图片文件
        return FileResponse(
            image_path,
            media_type='image/jpeg',  # 根据实际类型调整
            filename=os.path.basename(image_path)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"读取图片时发生错误: {str(e)}"
        )


@app.post("/api/parse-folder-path")
async def parse_folder_path(request: FolderPathRequest):
    """
    尝试从文件路径列表中解析文件夹路径
    
    这个方法会尝试：
    1. 如果路径是完整路径，直接提取文件夹部分
    2. 如果路径是相对路径，尝试在当前工作目录或常见位置查找
    
    参数:
        request: 包含文件路径列表的请求
        
    返回:
        解析出的文件夹路径（如果成功）或错误信息
    """
    try:
        file_paths = request.file_paths
        
        if not file_paths or len(file_paths) == 0:
            raise HTTPException(status_code=400, detail="文件路径列表不能为空")
        
        # 尝试从第一个路径提取文件夹
        first_path = file_paths[0]
        
        # 如果路径包含分隔符，提取文件夹部分
        if '/' in first_path or '\\' in first_path:
            # 移除文件名，保留文件夹路径
            folder_path = first_path.rsplit('/', 1)[0] if '/' in first_path else first_path.rsplit('\\', 1)[0]
            
            # 检查是否是完整路径（Windows: 包含盘符，Unix: 以 / 开头）
            is_absolute = (len(folder_path) >= 2 and folder_path[1] == ':') or folder_path.startswith('/')
            
            if is_absolute:
                # 完整路径，直接返回
                return {
                    "success": True,
                    "folder_path": folder_path,
                    "method": "extracted_from_full_path"
                }
            else:
                # 相对路径，尝试在当前工作目录查找
                current_dir = os.getcwd()
                potential_path = os.path.join(current_dir, folder_path)
                
                if os.path.exists(potential_path) and os.path.isdir(potential_path):
                    return {
                        "success": True,
                        "folder_path": potential_path,
                        "method": "resolved_from_relative_path"
                    }
        
        # 如果无法解析，返回错误
        raise HTTPException(
            status_code=400,
            detail="无法从文件路径中解析文件夹路径。请确保提供的是完整路径或有效的相对路径。"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"解析文件夹路径时发生错误: {str(e)}"
        )


@app.post("/api/cluster-images")
async def cluster_images(request: ClusterRequest):
    """
    对指定目录的图片进行颜色聚类
    
    参数:
        request: 包含图片目录路径和聚类数量的请求
    
    返回:
        聚类结果，包含每张图片的信息和每个类别的统计
    """
    try:
        image_dir = request.image_dir
        n_clusters = request.n_clusters
        center_ratio = request.center_ratio
        
        # 检查目录是否存在
        if not os.path.exists(image_dir):
            raise HTTPException(status_code=400, detail=f"目录不存在: {image_dir}")
        
        if not os.path.isdir(image_dir):
            raise HTTPException(status_code=400, detail=f"路径不是目录: {image_dir}")
        
        # 获取所有图片文件
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
        image_paths = []
        for ext in image_extensions:
            image_paths.extend(glob.glob(os.path.join(image_dir, ext)))
            image_paths.extend(glob.glob(os.path.join(image_dir, ext.upper())))
        
        image_paths = sorted(list(set(image_paths)))  # 去重并排序
        
        if len(image_paths) == 0:
            raise HTTPException(status_code=400, detail=f"目录中未找到图片文件: {image_dir}")
        
        if len(image_paths) < n_clusters:
            raise HTTPException(
                status_code=400,
                detail=f"图片数量({len(image_paths)})少于聚类数量({n_clusters})"
            )
        
        # 提取所有图片的LAB值
        lab_vectors = []
        valid_paths = []
        
        for img_path in image_paths:
            try:
                lab_vector = extract_lab_from_image(img_path, center_ratio=center_ratio)
                lab_vectors.append(lab_vector)
                valid_paths.append(img_path)
            except Exception as e:
                print(f"警告: 跳过图片 {img_path}: {e}")
        
        if len(lab_vectors) == 0:
            raise HTTPException(status_code=400, detail="未能提取任何图片的LAB值")
        
        lab_vectors = np.array(lab_vectors)
        
        # 执行聚类
        clusters = cluster_images_by_color_de2000(
            lab_vectors=lab_vectors,
            image_paths=valid_paths,
            n_clusters=n_clusters,
            linkage='average'
        )
        
        # 计算类间距离
        inter_cluster_stats = calculate_inter_cluster_distance(clusters)
        
        # 构建图片信息列表（包含类别ID）
        images_info = []
        for cluster_id, cluster_info in clusters.items():
            for idx, img_path in enumerate(cluster_info['images']):
                img_idx = cluster_info['indices'][idx]
                images_info.append({
                    "path": img_path,
                    "filename": os.path.basename(img_path),
                    "lab": {
                        "L": float(lab_vectors[img_idx][0]),
                        "a": float(lab_vectors[img_idx][1]),
                        "b": float(lab_vectors[img_idx][2])
                    },
                    "cluster_id": cluster_id
                })
        
        # 构建响应
        response = {
            "success": True,
            "total_images": len(valid_paths),
            "n_clusters": n_clusters,
            "inter_cluster_stats": inter_cluster_stats,
            "images": images_info,
            "clusters": {
                str(cluster_id): {
                    "cluster_id": cluster_id,
                    "count": info['count'],
                    "lab_mean": info['lab_mean'],
                    "lab_std": info['lab_std'],
                    "de2000_mean": info['de2000_mean'],
                    "de2000_max": info['de2000_max'],
                    "de2000_std": info['de2000_std'],
                    "de2000_intra_mean": info['de2000_intra_mean'],
                    "de2000_intra_max": info['de2000_intra_max'],
                    "image_paths": info['images']
                }
                for cluster_id, info in clusters.items()
            }
        }

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"聚类处理时发生错误: {str(e)}"
        )


class SaveClusterRequest(BaseModel):
    """保存聚类结果到 SQLite 的请求模型"""
    image_dir: str
    n_clusters: int
    result: dict


@app.post("/api/save-cluster-result")
async def save_cluster_result(request: SaveClusterRequest):
    """
    将前端当前展示的聚类结果保存到 SQLite。

    说明：
      - 由前端在“聚类完成后，用户点击保存按钮”时触发
      - 仅在有有效结果时调用
    """
    try:
        payload = request.result
        inter_cluster_stats = payload.get("inter_cluster_stats", {})
        total_images = int(payload.get("total_images", 0))

        record_id = insert_cluster_result(
            image_dir=request.image_dir,
            n_clusters=request.n_clusters,
            total_images=total_images,
            inter_cluster_stats=inter_cluster_stats,
            payload_json=json.dumps(payload, ensure_ascii=False),
        )

        return {
            "success": True,
            "id": record_id,
            "message": "聚类结果已保存到本地数据库（SQLite）"
        }
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"保存聚类结果时发生错误: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    import sys
    
    # 检测是否为打包后的环境（PyInstaller）
    is_packaged = getattr(sys, 'frozen', False) or hasattr(sys, '_MEIPASS')
    
    if is_packaged:
        # 生产模式：打包后的环境，禁用 reload
        uvicorn.run(
            app,  # 直接使用 app 对象
            host="0.0.0.0",
            port=8000,
            reload=False,  # 生产环境禁用自动重载
            loop="asyncio"
        )
    else:
        # 开发模式：支持 reload
        uvicorn.run(
            "main:app",  # 使用导入字符串
            host="0.0.0.0",
            port=8000,
            reload=True,  # 开发时自动重载
            loop="asyncio"
        )
    
    # 生产模式（使用命令行）：
    # uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

