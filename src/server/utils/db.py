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
    初始化数据库，创建用于保存聚类结果的表。

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
                payload_json TEXT NOT NULL
            )
            """
        )


def insert_cluster_result(
    image_dir: str,
    n_clusters: int,
    total_images: int,
    inter_cluster_stats: Dict[str, Any],
    payload_json: str,
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
                payload_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ),
        )
        return int(cur.lastrowid)

