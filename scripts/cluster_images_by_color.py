"""
图片颜色聚类工具 - 命令行脚本
读取图片目录，提取LAB值，使用ΔE2000进行聚类，输出每个类别的统计信息
"""

import cv2
import numpy as np
import os
import glob
from pathlib import Path
import json
from typing import List
import argparse

from utils.imgtool import bgr_to_lab, extract_center_region, extract_lab_from_mask
from utils.color_clustering import (
    cluster_images_by_color_de2000,
    calculate_inter_cluster_distance
)


def extract_lab_from_image(image_path: str, center_ratio: float = 0.4) -> np.ndarray:
    """
    从图片中提取中心区域的LAB值
    
    参数:
        image_path: 图片路径
        center_ratio: 中心区域比例
    
    返回:
        LAB向量 [L, a, b]
    """
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    h, w = img.shape[:2]
    mask = np.ones((h, w), dtype=np.uint8) * 255
    center_mask = extract_center_region(mask, ratio=center_ratio)
    lab_image = bgr_to_lab(img)
    lab_vector = extract_lab_from_mask(lab_image, center_mask, use_median=True)
    
    return lab_vector


def cluster_images(
    image_dir: str,
    n_clusters: int,
    output_dir: Optional[str] = None,
    center_ratio: float = 0.4,
    output_format: str = 'json'  # 'json' 或 'txt'
) -> None:
    """
    聚类图片目录中的所有图片
    
    参数:
        image_dir: 图片目录路径
        n_clusters: 聚类数量
        output_dir: 输出目录（如果不指定，则在image_dir下创建）
        center_ratio: 中心区域比例
        output_format: 输出格式（'json' 或 'txt'）
    """
    # 获取所有图片文件
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
    image_paths = []
    for ext in image_extensions:
        image_paths.extend(glob.glob(os.path.join(image_dir, ext)))
        image_paths.extend(glob.glob(os.path.join(image_dir, ext.upper())))
    
    image_paths = sorted(list(set(image_paths)))  # 去重并排序
    
    if len(image_paths) == 0:
        print(f"错误: 在目录 {image_dir} 中未找到图片文件")
        return
    
    print(f"找到 {len(image_paths)} 张图片")
    print(f"开始提取LAB值...")
    
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
    
    lab_vectors = np.array(lab_vectors)
    print(f"成功提取 {len(lab_vectors)} 张图片的LAB值")
    
    # 执行聚类
    print(f"\n开始聚类 (n_clusters={n_clusters})...")
    clusters = cluster_images_by_color_de2000(
        lab_vectors=lab_vectors,
        image_paths=valid_paths,
        n_clusters=n_clusters,
        linkage='average'  # 使用average链接，配合ΔE2000距离
    )
    
    # 计算类间距离
    inter_cluster_stats = calculate_inter_cluster_distance(clusters)
    
    # 输出结果
    if output_dir is None:
        output_dir = os.path.join(image_dir, f"clustering_result_n{n_clusters}")
    os.makedirs(output_dir, exist_ok=True)
    
    # 保存详细结果（JSON格式）
    result_json = {
        'n_clusters': n_clusters,
        'total_images': len(valid_paths),
        'inter_cluster_stats': inter_cluster_stats,
        'clusters': {}
    }
    
    for cluster_id, cluster_info in clusters.items():
        result_json['clusters'][cluster_id] = cluster_info
    
    json_path = os.path.join(output_dir, 'clustering_result.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result_json, f, indent=2, ensure_ascii=False)
    print(f"\n详细结果已保存到: {json_path}")
    
    # 打印统计信息
    print("\n" + "=" * 80)
    print("聚类结果统计")
    print("=" * 80)
    print(f"总图片数: {len(valid_paths)}")
    print(f"聚类数量: {n_clusters}")
    print(f"\n类间距离统计（ΔE2000）:")
    print(f"  平均: {inter_cluster_stats['mean']:.2f}")
    print(f"  最小: {inter_cluster_stats['min']:.2f}")
    print(f"  最大: {inter_cluster_stats['max']:.2f}")
    print(f"  标准差: {inter_cluster_stats['std']:.2f}")
    
    print(f"\n各类别详细信息:")
    print("-" * 80)
    for cluster_id in sorted(clusters.keys()):
        info = clusters[cluster_id]
        print(f"\n类别 {cluster_id} (共 {info['count']} 张图片):")
        print(f"  基准LAB值: L={info['lab_mean'][0]:.2f}, a={info['lab_mean'][1]:.2f}, b={info['lab_mean'][2]:.2f}")
        print(f"  LAB标准差: L±{info['lab_std'][0]:.2f}, a±{info['lab_std'][1]:.2f}, b±{info['lab_std'][2]:.2f}")
        print(f"  类内误差 (与中心的ΔE2000):")
        print(f"    平均: {info['de2000_mean']:.2f}")
        print(f"    最大: {info['de2000_max']:.2f}")
        print(f"    标准差: {info['de2000_std']:.2f}")
        print(f"  类内误差 (所有对之间ΔE2000):")
        print(f"    平均: {info['de2000_intra_mean']:.2f}")
        print(f"    最大: {info['de2000_intra_max']:.2f}")
        print(f"  图片列表: {info['images'][:5]}{'...' if len(info['images']) > 5 else ''}")
    
    # 保存文本摘要
    txt_path = os.path.join(output_dir, 'clustering_summary.txt')
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("图片颜色聚类结果摘要\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"总图片数: {len(valid_paths)}\n")
        f.write(f"聚类数量: {n_clusters}\n\n")
        
        f.write("类间距离统计（ΔE2000）:\n")
        f.write(f"  平均: {inter_cluster_stats['mean']:.2f}\n")
        f.write(f"  最小: {inter_cluster_stats['min']:.2f}\n")
        f.write(f"  最大: {inter_cluster_stats['max']:.2f}\n\n")
        
        for cluster_id in sorted(clusters.keys()):
            info = clusters[cluster_id]
            f.write(f"\n类别 {cluster_id} (共 {info['count']} 张图片):\n")
            f.write(f"  基准LAB值: L={info['lab_mean'][0]:.2f}, a={info['lab_mean'][1]:.2f}, b={info['lab_mean'][2]:.2f}\n")
            f.write(f"  LAB标准差: L±{info['lab_std'][0]:.2f}, a±{info['lab_std'][1]:.2f}, b±{info['lab_std'][2]:.2f}\n")
            f.write(f"  类内平均ΔE2000: {info['de2000_mean']:.2f}\n")
            f.write(f"  类内最大ΔE2000: {info['de2000_max']:.2f}\n")
            f.write(f"  类内所有对平均ΔE2000: {info['de2000_intra_mean']:.2f}\n")
            f.write(f"  图片:\n")
            for img_path in info['images']:
                f.write(f"    - {img_path}\n")
    
    print(f"\n摘要已保存到: {txt_path}")
    print("=" * 80)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='按颜色聚类图片（使用ΔE2000）')
    parser.add_argument('image_dir', type=str, help='图片目录路径')
    parser.add_argument('n_clusters', type=int, help='聚类数量')
    parser.add_argument('--output_dir', type=str, default=None, help='输出目录（默认在图片目录下创建）')
    parser.add_argument('--center_ratio', type=float, default=0.4, help='中心区域比例（默认0.4）')
    
    args = parser.parse_args()
    
    cluster_images(
        image_dir=args.image_dir,
        n_clusters=args.n_clusters,
        output_dir=args.output_dir,
        center_ratio=args.center_ratio
    )

