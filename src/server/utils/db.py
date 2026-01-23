import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterable, Optional


DB_FILENAME = "vision_sorter.db"


def get_db_path() -> str:
    """
    获取 SQLite 数据库文件路径。
    默认存放在后端 main.py 同级目录下，避免工作目录变化带来的路径问题。
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # utils/ -> server/ 目录
    server_dir = os.path.dirname(base_dir)
    return os.path.join(server_dir, DB_FILENAME)


@contextmanager
def get_connection():
    """获取 SQLite 连接的上下文管理器，自动提交和关闭。"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """
    初始化数据库，创建用于保存聚类结果和检测结果的表。

    表结构说明（cluster_results）：
      - id: 主键
      - created_at: 创建时间
      - image_dir: 聚类时使用的图片目录
      - n_clusters: 聚类数量
      - total_images: 图片总数
      - inter_cluster_mean: 类间平均 ΔE2000
      - inter_cluster_min: 类间最小 ΔE2000
      - inter_cluster_max: 类间最大 ΔE2000
      - inter_cluster_std: 类间 ΔE2000 标准差
      - payload_json: 完整的聚类结果 JSON（方便后续分析与回放）
    
    表结构说明（detection_results）：
      - id: 主键
      - created_at: 创建时间
      - image_dir: 检测时使用的图片目录
      - total_images: 检测的图片总数
      - classified: 成功归类的图片数量
      - payload_json: 完整的检测结果 JSON（方便后续分析与回放）
      - task_name: 前端任务名称
      - task_id: 前端任务ID
    """
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS cluster_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                image_dir TEXT NOT NULL,
                n_clusters INTEGER NOT NULL,
                total_images INTEGER NOT NULL,
                inter_cluster_mean REAL,
                inter_cluster_min REAL,
                inter_cluster_max REAL,
                inter_cluster_std REAL,
                payload_json TEXT NOT NULL,
                task_name TEXT DEFAULT '',
                task_id TEXT DEFAULT ''
            )
            """
        )

        # 检测结果表（如不存在则创建）
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS detection_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                image_dir TEXT NOT NULL,
                total_images INTEGER NOT NULL,
                classified INTEGER NOT NULL,
                payload_json TEXT NOT NULL,
                task_name TEXT DEFAULT '',
                task_id TEXT DEFAULT ''
            )
            """
        )
        
        # 迁移：为已存在的 cluster_results 表添加 task_name 和 task_id 列（如果不存在）
        try:
            cur.execute("ALTER TABLE cluster_results ADD COLUMN task_name TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # 列已存在，忽略错误
        
        try:
            cur.execute("ALTER TABLE cluster_results ADD COLUMN task_id TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # 列已存在，忽略错误

        # -----------------------------------------------------------
        # 新增 task_images 表，用于存储海量图片数据，实现后端分页
        # -----------------------------------------------------------
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS task_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_db_id INTEGER NOT NULL,
                task_type TEXT NOT NULL,
                filename TEXT,
                path TEXT,
                cluster_id INTEGER,
                lab_json TEXT,
                distance REAL,
                status TEXT,
                elapsed_time INTEGER,
                created_at TEXT
            )
            """
        )
        # 创建索引以加速查询
        cur.execute("CREATE INDEX IF NOT EXISTS idx_task_images_task ON task_images(task_db_id, task_type)")


def insert_task_images_batch(conn, task_db_id: int, task_type: str, images: list[Dict[str, Any]]):
    """
    批量插入图片记录到 task_images 表
    """
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    
    # 准备批量插入的数据
    data_to_insert = []
    import json
    
    for img in images:
        # 通用字段
        filename = img.get('filename', '')
        path = img.get('path', '')
        lab_data = img.get('lab', {})
        lab_json = json.dumps(lab_data) if lab_data else None
        
        # 差异化字段
        if task_type == 'cluster':
            # 聚类任务的图片结构
            cluster_id = img.get('cluster_id')
            distance = None
            status = None
            elapsed_time = None
        else:
            # 检测任务的图片结构
            cluster_id = img.get('matched_cluster_id')
            distance = img.get('distance')
            status = img.get('status')
            elapsed_time = img.get('elapsed_time')
            
        data_to_insert.append((
            task_db_id,
            task_type,
            filename,
            path,
            cluster_id,
            lab_json,
            distance,
            status,
            elapsed_time,
            created_at
        ))
        
    # 执行批量插入
    # 分批执行，避免单条 SQL 过长
    batch_size = 500
    cur = conn.cursor()
    
    for i in range(0, len(data_to_insert), batch_size):
        batch = data_to_insert[i : i + batch_size]
        cur.executemany(
            """
            INSERT INTO task_images (
                task_db_id, task_type, filename, path, cluster_id, 
                lab_json, distance, status, elapsed_time, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            batch
        )


def insert_cluster_result(
    image_dir: str,
    n_clusters: int,
    total_images: int,
    inter_cluster_stats: Dict[str, Any],
    payload_json: str,
    task_name: str = "",
    task_id: str = "",
) -> int:
    """插入一条聚类结果记录，返回新纪录的 id。"""
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    
    import json
    # 解析 payload 以分离图片数据
    try:
        payload = json.loads(payload_json)
        # 获取所有图片列表
        images = payload.get('images', [])
        
        # 从 payload 中移除庞大的 images 列表，仅保留 cluster 统计信息
        # 注意：前端某些组件可能依赖 clusters.{id}.images，如果那个也很大，也要移除
        # 目前策略：移除根节点的 images 列表，保留 clusters 中的 images (如果是路径列表的话通常还好，但如果是几万张...)
        # 为了稳妥，我们暂时只移除根节点的 images 列表，因为它最冗余。
        # 如果 clusters 里的 images 列表也很大，建议也移除，前端详情页只展示统计。
        
        # 深度清理：
        if 'images' in payload:
            del payload['images']
            
        # 清理 clusters 中的 images 列表，防止 payload 依然过大
        if 'clusters' in payload:
            for cid in payload['clusters']:
                if 'images' in payload['clusters'][cid]:
                    # 将图片路径列表替换为数量，或者直接移除
                    # 前端 ClusterTabs 可能用到这个... 
                    # 如果前端 ClusterTabs 用它来展示 "分类详情 -> 图片列表"，那也需要改造成读接口。
                    # 暂时保留 clusters 里的 images (仅路径)，假设它比完整 info 小很多。
                    # 如果路径也很长，建议删除。
                    # 让我们做得彻底一点：删除它。
                    # 但是前端 ClusterTabs 依赖它。如果不改前端 ClusterTabs，这里删除会报错。
                    # 我们将在后续步骤重构 ClusterTabs。现在先保留，或者只删除根 images。
                    # 鉴于用户说有几万张，payload['clusters'][cid]['images'] 也会很大。
                    # 我们先只删根 images，它是最大的冗余。
                    pass

        # 重新序列化 payload
        optimized_payload_json = json.dumps(payload, ensure_ascii=False)
        
    except Exception as e:
        print(f"Error optimizing payload: {e}")
        optimized_payload_json = payload_json
        images = []

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO cluster_results (
                created_at,
                image_dir,
                n_clusters,
                total_images,
                inter_cluster_mean,
                inter_cluster_min,
                inter_cluster_max,
                inter_cluster_std,
                payload_json,
                task_name,
                task_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                image_dir,
                n_clusters,
                total_images,
                float(inter_cluster_stats.get("mean", 0.0)) if inter_cluster_stats else None,
                float(inter_cluster_stats.get("min", 0.0)) if inter_cluster_stats else None,
                float(inter_cluster_stats.get("max", 0.0)) if inter_cluster_stats else None,
                float(inter_cluster_stats.get("std", 0.0)) if inter_cluster_stats else None,
                optimized_payload_json,
                task_name,
                task_id,
            ),
        )
        record_id = int(cur.lastrowid)
        
        # 批量插入图片到 task_images 表
        if images:
            insert_task_images_batch(conn, record_id, 'cluster', images)
            
        return record_id


def insert_detection_result(
    image_dir: str,
    total_images: int,
    classified: int,
    payload_json: str,
    task_name: str = "",
    task_id: str = "",
) -> int:
    """插入一条检测结果记录，返回新纪录的 id。"""
    created_at = datetime.utcnow().isoformat(timespec="seconds") + "Z"
    
    import json
    # 解析 payload 以分离图片数据
    try:
        payload = json.loads(payload_json)
        results = payload.get('results', [])
        
        # 移除 results 列表
        if 'results' in payload:
            del payload['results']
            
        optimized_payload_json = json.dumps(payload, ensure_ascii=False)
    except Exception as e:
        print(f"Error optimizing payload: {e}")
        optimized_payload_json = payload_json
        results = []

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO detection_results (
                created_at,
                image_dir,
                total_images,
                classified,
                payload_json,
                task_name,
                task_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                image_dir,
                total_images,
                classified,
                optimized_payload_json,
                task_name,
                task_id,
            ),
        )
        record_id = int(cur.lastrowid)
        
        # 批量插入图片到 task_images 表
        if results:
            insert_task_images_batch(conn, record_id, 'detect', results)
            
        return record_id


def get_all_cluster_results() -> list:
    """
    获取所有已保存的聚类结果列表（不包含 payload_json）。
    用于列表展示，减少数据传输量。
    """
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, created_at, image_dir, n_clusters, total_images,
                   inter_cluster_mean, inter_cluster_min, inter_cluster_max, inter_cluster_std,
                   task_name, task_id
            FROM cluster_results
            ORDER BY created_at DESC
            """
        )
        rows = cur.fetchall()
        results = []
        for row in rows:
            results.append({
                "id": row[0],
                "created_at": row[1],
                "image_dir": row[2],
                "n_clusters": row[3],
                "total_images": row[4],
                "inter_cluster_mean": row[5],
                "inter_cluster_min": row[6],
                "inter_cluster_max": row[7],
                "inter_cluster_std": row[8],
                "task_name": row[9],
                "task_id": row[10],
                # "payload_json": row[11], # 列表接口不返回大字段
            })
        return results


def get_cluster_result_payload(result_id: int) -> Optional[str]:
    """获取指定聚类结果的 payload_json"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT payload_json FROM cluster_results WHERE id = ?", (result_id,))
        row = cur.fetchone()
        return row[0] if row else None


def get_all_detection_results() -> list:
    """
    获取所有已保存的检测结果列表（不包含 payload_json）。
    用于列表展示。
    """
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, created_at, image_dir, total_images, classified,
                   task_name, task_id
            FROM detection_results
            ORDER BY created_at DESC
            """
        )
        rows = cur.fetchall()
        results = []
        for row in rows:
            results.append({
                "id": row[0],
                "created_at": row[1],
                "image_dir": row[2],
                "total_images": row[3],
                "classified": row[4],
                "task_name": row[5],
                "task_id": row[6],
                # "payload_json": row[7], # 列表接口不返回大字段
            })
        return results


def get_detection_result_payload(result_id: int) -> Optional[str]:
    """获取指定检测结果的 payload_json"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT payload_json FROM detection_results WHERE id = ?", (result_id,))
        row = cur.fetchone()
        return row[0] if row else None


def get_task_images(
    task_db_id: int, 
    task_type: str, 
    page: int = 1, 
    page_size: int = 20,
    search: str = "",
    cluster_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    分页获取任务关联的图片列表
    """
    offset = (page - 1) * page_size
    
    with get_connection() as conn:
        cur = conn.cursor()
        
        # 构建查询条件
        conditions = ["task_db_id = ?", "task_type = ?"]
        params = [task_db_id, task_type]
        
        if search:
            conditions.append("filename LIKE ?")
            params.append(f"%{search}%")
            
        if cluster_id is not None:
            if cluster_id == -1: # 未归类
                conditions.append("cluster_id IS NULL")
            else:
                conditions.append("cluster_id = ?")
                params.append(cluster_id)
                
        where_clause = " AND ".join(conditions)
        
        # 查询总数
        count_sql = f"SELECT COUNT(*) FROM task_images WHERE {where_clause}"
        cur.execute(count_sql, params)
        total_count = cur.fetchone()[0]
        
        # 查询分页数据
        sql = f"""
            SELECT id, filename, path, cluster_id, lab_json, distance, status, elapsed_time
            FROM task_images 
            WHERE {where_clause}
            ORDER BY id ASC
            LIMIT ? OFFSET ?
        """
        cur.execute(sql, params + [page_size, offset])
        rows = cur.fetchall()
        
        items = []
        import json
        for row in rows:
            lab_data = json.loads(row[4]) if row[4] else None
            
            # 构造前端兼容的数据结构
            item = {
                "id": row[0],
                "filename": row[1],
                "path": row[2],
                "lab": lab_data,
            }
            
            if task_type == 'cluster':
                item["cluster_id"] = row[3]
            else:
                item["matched_cluster_id"] = row[3]
                item["distance"] = row[5]
                item["status"] = row[6]
                item["elapsed_time"] = row[7]
                
            items.append(item)
            
        return {
            "items": items,
            "total": total_count,
            "page": page,
            "pageSize": page_size
        }


def delete_cluster_result(result_id: int) -> bool:
    """删除指定的聚类结果。"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM cluster_results WHERE id = ?", (result_id,))
        success = cur.rowcount > 0
        if success:
            # 级联删除图片记录
            cur.execute("DELETE FROM task_images WHERE task_db_id = ? AND task_type = 'cluster'", (result_id,))
        return success


def delete_detection_result(result_id: int) -> bool:
    """删除指定的检测结果。"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM detection_results WHERE id = ?", (result_id,))
        success = cur.rowcount > 0
        if success:
            # 级联删除图片记录
            cur.execute("DELETE FROM task_images WHERE task_db_id = ? AND task_type = 'detect'", (result_id,))
        return success


