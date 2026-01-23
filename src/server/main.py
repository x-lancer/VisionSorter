"""
LAB颜色值计算服务API
提供HTTP接口，接收图片，计算中心区域的LAB值
支持并发处理
"""

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Query, WebSocket, WebSocketDisconnect, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import Optional, List, Union
from pydantic import BaseModel
import os
import glob
from utils.imgtool import bgr_to_lab, extract_center_region, extract_lab_from_mask
from utils.color_clustering import (
    cluster_images_by_color_de2000,
    calculate_inter_cluster_distance
)
from utils.db import init_db, insert_cluster_result, insert_detection_result
import json


app = FastAPI(
    title="LAB颜色值计算服务",
    description="接收图片，计算中心区域的LAB颜色值，支持颜色聚类",
    version="1.0.0"
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    import json
    print(f"[ERROR] Request Validation Error: {exc.errors()}")
    try:
        body = await request.json()
        # print(f"[ERROR] Body: {json.dumps(body, ensure_ascii=False)[:1000]}...") # Print first 1000 chars
    except:
        pass
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
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
        
        print(f"聚类完成，生成的类别ID: {list(clusters.keys())}")
        
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
    task_name: str = ""
    task_id: str = ""
    class Config:
        extra = "ignore"


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
            task_name=request.task_name,
            task_id=request.task_id,
        )

        return {
            "success": True,
            "id": record_id,
            "message": "聚类结果已保存到本地数据库"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"保存聚类结果时发生错误: {str(e)}"
        )


class SaveDetectionRequest(BaseModel):
    """保存检测结果到 SQLite 的请求模型"""
    image_dir: str
    total: int
    classified: int
    results: list[dict]
    max_scale: float = 1.1
    task_name: str = ""
    task_id: str = ""
    cluster_result: Optional[dict] = None
    cluster_result_id: Optional[Union[str, int]] = None
    # 允许接收任何额外字段
    class Config:
        extra = "ignore"


@app.post("/api/save-detection-result")
async def save_detection_result(request: SaveDetectionRequest):
    """
    将前端当前展示的检测结果保存到 SQLite。

    说明：
      - 由前端在“检测完成后，用户点击保存结果按钮”时触发
      - 仅在有有效结果时调用
    """
    try:
      # 计算检测结果的统计分布，以便后续不需要加载所有图片就能展示统计图表
      statistics = {}
      if request.cluster_result and 'clusters' in request.cluster_result:
          # 初始化统计字典
          for cluster_id in request.cluster_result['clusters']:
              statistics[cluster_id] = 0
          statistics['-1'] = 0 # 未归类
          
          # 统计数量
          for res in request.results:
              cid = str(res.get('matched_cluster_id', -1)) if res.get('matched_cluster_id') is not None else '-1'
              if cid in statistics:
                  statistics[cid] += 1
              else:
                  statistics[cid] = 1 # 防御性编程

      # 截取最新的部分结果作为预览，以便概览页显示
      # 取最后10条
      recent_results = request.results[-10:] if request.results else []

      payload = {
          "image_dir": request.image_dir,
          "total": request.total,
          "classified": request.classified,
          # "results": request.results, # 移除海量结果列表
          "recent_results": recent_results, # 保存少量预览数据
          "statistics": statistics, # 保存预计算的统计数据
          "max_scale": request.max_scale,
          "cluster_result": request.cluster_result,
          "cluster_result_id": request.cluster_result_id,
      }

      record_id = insert_detection_result(
          image_dir=request.image_dir,
          total_images=request.total,
          classified=request.classified,
          payload_json=json.dumps(payload, ensure_ascii=False),
          task_name=request.task_name,
          task_id=request.task_id,
      )
      
      # 批量插入图片记录到 task_images 表
      from utils.db import insert_task_images_batch, get_connection
      if request.results:
          with get_connection() as conn:
              insert_task_images_batch(conn, record_id, 'detect', request.results)

      return {
          "success": True,
          "id": record_id,
          "message": "检测结果已保存到本地数据库"
      }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] 保存检测结果失败: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"保存检测结果时发生错误: {str(e)}"
        )


@app.get("/api/saved-cluster-results")
async def get_saved_cluster_results():
    """
    获取所有已保存的聚类结果列表（仅元数据，不含详细结果）。
    """
    try:
        from utils.db import get_all_cluster_results
        results = get_all_cluster_results()
        return {
            "success": True,
            "data": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取聚类结果时发生错误: {str(e)}"
        )


@app.get("/api/saved-detection-results")
async def get_saved_detection_results():
    """
    获取所有已保存的检测结果列表（仅元数据，不含详细结果）。
    """
    try:
        from utils.db import get_all_detection_results
        results = get_all_detection_results()
        return {
            "success": True,
            "data": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取检测结果时发生错误: {str(e)}"
        )


@app.get("/api/result-detail/{type}/{id}")
async def get_result_detail(type: str, id: int):
    """
    获取指定结果的详细信息（payload_json）。
    按需加载大文件数据。
    
    参数:
        type: "cluster" 或 "detect"
        id: 数据库记录ID
    """
    try:
        if type == "cluster":
            from utils.db import get_cluster_result_payload
            payload_json = get_cluster_result_payload(id)
        elif type == "detect":
            from utils.db import get_detection_result_payload
            payload_json = get_detection_result_payload(id)
        else:
            raise HTTPException(status_code=400, detail="未知的任务类型")
            
        if payload_json:
            return {
                "success": True,
                "data": json.loads(payload_json)
            }
        else:
             raise HTTPException(status_code=404, detail="未找到结果数据")
             
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取结果详情时发生错误: {str(e)}"
        )


@app.get("/api/task-images/{type}/{id}")
async def get_task_images_api(
    type: str, 
    id: int, 
    page: int = 1, 
    pageSize: int = 20, 
    search: str = "",
    clusterId: Optional[int] = Query(None, description="筛选分类ID，-1表示未归类")
):
    """
    分页获取任务的图片列表
    
    参数:
        type: "cluster" 或 "detect"
        id: 数据库记录ID
        page: 页码，从1开始
        pageSize: 每页数量
        search: 文件名搜索关键词
        clusterId: 筛选分类ID
    """
    try:
        from utils.db import get_task_images
        
        # 验证任务类型
        if type not in ["cluster", "detect"]:
            raise HTTPException(status_code=400, detail="未知的任务类型")
            
        result = get_task_images(
            task_db_id=id,
            task_type=type,
            page=page,
            page_size=pageSize,
            search=search,
            cluster_id=clusterId
        )
        
        return {
            "success": True,
            "data": result
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取图片列表时发生错误: {str(e)}"
        )


@app.delete("/api/delete-result/{result_id}")
async def delete_result(result_id: int, type: str = Query("cluster", description="任务类型: cluster 或 detect")):
    """
    删除指定的任务结果。
    """
    try:
        if type == "detect":
            from utils.db import delete_detection_result
            success = delete_detection_result(result_id)
        else:
            from utils.db import delete_cluster_result
            success = delete_cluster_result(result_id)
            
        if success:
            return {
                "success": True,
                "message": "删除成功"
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"未找到 ID 为 {result_id} 的记录"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"删除结果时发生错误: {str(e)}"
        )


def process_single_image(
    image_path: str,
    clusters: dict,
    max_scale: float = 1.1
) -> dict:
    """
    处理单张图片的检测逻辑
    
    参数:
        image_path: 图片路径
        clusters: 聚类结果字典
        max_scale: 类内最大距离的放大系数
    
    返回:
        检测结果字典
    """
    import time
    from skimage.color import deltaE_ciede2000
    from utils.imgtool import extract_lab_from_image
    
    # 记录开始时间
    start_time = time.time()
    
    try:
        # 提取图片的 Lab 值
        lab_new = extract_lab_from_image(image_path, center_ratio=0.4)
        L_new, a_new, b_new = lab_new
        
        # 步骤1: 计算到所有类别中心的 ΔE2000
        best_cluster_id = None
        best_distance = float('inf')
        
        for cluster_id_str, cluster_info in clusters.items():
            cluster_id = int(cluster_id_str)
            lab_mean = cluster_info.get('lab_mean', [])
            
            if len(lab_mean) != 3:
                continue
            
            # 计算 ΔE2000 距离
            lab_new_reshaped = np.array([L_new, a_new, b_new]).reshape(1, 1, 3)
            lab_mean_reshaped = np.array(lab_mean).reshape(1, 1, 3)
            distance = deltaE_ciede2000(lab_new_reshaped, lab_mean_reshaped)[0, 0]
            
            if distance < best_distance:
                best_distance = distance
                best_cluster_id = cluster_id
        
        # 步骤2: 判断是否可信（基于类内最大距离阈值）
        matched_cluster_id = None
        status = '未归类'
        
        if best_cluster_id is not None:
            cluster_info = clusters.get(str(best_cluster_id), {})
            de2000_intra_max = cluster_info.get('de2000_intra_max', 0.0)
            threshold = de2000_intra_max * max_scale
            
            if best_distance <= threshold:
                matched_cluster_id = best_cluster_id
                status = '已归类'
            else:
                status = '距离过远'
        
        # 计算耗时（毫秒）
        elapsed_time = int((time.time() - start_time) * 1000)
        
        # 返回检测结果
        return {
            'filename': os.path.basename(image_path),
            'path': image_path,
            'lab': {
                'L': float(L_new),
                'a': float(a_new),
                'b': float(b_new),
            },
            'matched_cluster_id': matched_cluster_id,
            'distance': float(best_distance),
            'status': status,
            'elapsed_time': elapsed_time,
        }
        
    except Exception as e:
        # 计算耗时（毫秒）
        elapsed_time = int((time.time() - start_time) * 1000)
        
        # 单张图片处理失败，返回错误信息
        return {
            'filename': os.path.basename(image_path),
            'path': image_path,
            'lab': None,
            'matched_cluster_id': None,
            'distance': None,
            'status': f'处理失败: {str(e)}',
            'elapsed_time': elapsed_time,
        }


class DetectRequest(BaseModel):
    """检测任务请求模型"""
    image_dir: str
    cluster_result: dict  # 聚类结果数据
    max_scale: float = 1.1  # 类内最大距离的放大系数，默认1.1


@app.post("/api/detect-images")
async def detect_images(request: DetectRequest):
    """
    基于已有聚类结果，检测新图片目录中的图片，将每张图片归类到最相近的类别。
    """
    try:
        from skimage.color import deltaE_ciede2000
        from utils.imgtool import extract_lab_from_image
        
        image_dir = request.image_dir.strip()
        cluster_result = request.cluster_result
        max_scale = request.max_scale
        
        # 验证目录存在
        if not os.path.exists(image_dir) or not os.path.isdir(image_dir):
            raise HTTPException(status_code=400, detail=f"目录不存在: {image_dir}")
        
        # 获取所有图片文件
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff', '*.tif']
        image_paths = []
        for ext in image_extensions:
            image_paths.extend(glob.glob(os.path.join(image_dir, ext)))
            image_paths.extend(glob.glob(os.path.join(image_dir, ext.upper())))
        
        if not image_paths:
            raise HTTPException(status_code=400, detail=f"目录中没有找到图片文件: {image_dir}")
        
        # 获取聚类结果的 clusters 数据
        clusters = cluster_result.get('clusters', {})
        if not clusters:
            raise HTTPException(status_code=400, detail="聚类结果中没有类别数据")
        
        # 检测结果列表
        detection_results = []
        
        # 依次处理每张图片
        for image_path in sorted(image_paths):
            result = process_single_image(image_path, clusters, max_scale)
            detection_results.append(result)
        
        return {
            "success": True,
            "results": detection_results,
            "total": len(detection_results),
            "classified": len([r for r in detection_results if r['matched_cluster_id'] is not None]),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"检测过程中发生错误: {str(e)}"
        )


@app.websocket("/ws/detect-images")
async def websocket_detect_images(websocket: WebSocket):
    """
    WebSocket 实时检测图片端点
    支持逐张图片处理并实时返回结果，支持取消检测
    """
    await websocket.accept()
    
    try:
        # 接收初始化参数
        init_data = await websocket.receive_json()
        image_dir = init_data.get('image_dir', '').strip()
        cluster_result = init_data.get('cluster_result', {})
        max_scale = init_data.get('max_scale', 1.1)
        
        # 验证参数
        if not image_dir or not os.path.exists(image_dir) or not os.path.isdir(image_dir):
            await websocket.send_json({
                'type': 'error',
                'message': f'目录不存在: {image_dir}'
            })
            await websocket.close()
            return
        
        # 获取聚类结果的 clusters 数据
        clusters = cluster_result.get('clusters', {})
        if not clusters:
            await websocket.send_json({
                'type': 'error',
                'message': '聚类结果中没有类别数据'
            })
            await websocket.close()
            return
        
        # 获取所有图片文件
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp', '*.tiff', '*.tif']
        image_paths = []
        for ext in image_extensions:
            image_paths.extend(glob.glob(os.path.join(image_dir, ext)))
            image_paths.extend(glob.glob(os.path.join(image_dir, ext.upper())))
        
        if not image_paths:
            await websocket.send_json({
                'type': 'error',
                'message': f'目录中没有找到图片文件: {image_dir}'
            })
            await websocket.close()
            return
        
        image_paths = sorted(image_paths)
        total = len(image_paths)
        
        # 发送开始信号
        await websocket.send_json({
            'type': 'start',
            'total': total
        })
        
        # 依次处理每张图片
        classified_count = 0
        for idx, image_path in enumerate(image_paths):
            # 检查是否收到取消信号（非阻塞）
            try:
                cancel_data = await asyncio.wait_for(
                    websocket.receive(), timeout=0.01
                )
                if cancel_data.get('type') == 'websocket.receive':
                    text_data = cancel_data.get('text', '')
                    json_data = cancel_data.get('json')
                    # 检查文本消息或 JSON 消息
                    if (text_data == 'cancel') or (json_data and json_data.get('type') == 'cancel'):
                        await websocket.send_json({
                            'type': 'cancelled',
                            'processed': idx,
                            'total': total
                        })
                        break
            except asyncio.TimeoutError:
                pass  # 没有取消信号，继续处理
            
            # 处理单张图片
            result = process_single_image(image_path, clusters, max_scale)
            
            # 统计归类数量
            if result.get('matched_cluster_id') is not None:
                classified_count += 1
            
            # 立即发送单张结果
            await websocket.send_json({
                'type': 'progress',
                'index': idx,
                'total': total,
                'result': result
            })
        
        # 发送完成信号
        await websocket.send_json({
            'type': 'completed',
            'total': total,
            'classified': classified_count
        })
        
    except WebSocketDisconnect:
        # 客户端主动断开连接，清理资源
        pass
    except Exception as e:
        try:
            await websocket.send_json({
                'type': 'error',
                'message': f'检测过程中发生错误: {str(e)}'
            })
        except:
            pass
        await websocket.close()


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

