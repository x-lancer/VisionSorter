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
                payload_json,
                task_name,
                task_id,
            ),
        )
        return int(cur.lastrowid)


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
                payload_json,
                task_name,
                task_id,
            ),
        )
        return int(cur.lastrowid)


def get_all_cluster_results() -> list:
    """获取所有已保存的聚类结果列表。"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, created_at, image_dir, n_clusters, total_images,
                   inter_cluster_mean, inter_cluster_min, inter_cluster_max, inter_cluster_std,
                   task_name, task_id, payload_json
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
                "payload_json": row[11],
            })
        return results


def get_all_detection_results() -> list:
    """获取所有已保存的检测结果列表。"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, created_at, image_dir, total_images, classified,
                   task_name, task_id, payload_json
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
                "payload_json": row[7],
            })
        return results


def delete_cluster_result(result_id: int) -> bool:
    """删除指定的聚类结果。"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM cluster_results WHERE id = ?", (result_id,))
        return cur.rowcount > 0


def delete_detection_result(result_id: int) -> bool:
    """删除指定的检测结果。"""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM detection_results WHERE id = ?", (result_id,))
        return cur.rowcount > 0


