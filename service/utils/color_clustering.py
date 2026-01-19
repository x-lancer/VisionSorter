"""
基于ΔE2000的颜色聚类工具
使用人眼感知最接近的ΔE2000距离进行聚类，并计算每个类别的统计信息
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from sklearn.cluster import AgglomerativeClustering
from scipy.spatial.distance import squareform, pdist
from skimage.color import deltaE_ciede2000
from utils.decorator import timer


@timer
def compute_de2000_distance_matrix(lab_vectors: np.ndarray) -> np.ndarray:
    """
    计算LAB向量之间的ΔE2000距离矩阵
    
    参数:
        lab_vectors: LAB向量数组，形状为 (n_samples, 3)
    
    返回:
        distance_matrix: 距离矩阵，形状为 (n_samples, n_samples)
    """
    n_samples = lab_vectors.shape[0]
    
    # 计算所有样本对之间的距离
    # 使用pdist计算上三角矩阵，然后转换为完整的距离矩阵
    lab_reshaped = lab_vectors.reshape(n_samples, 1, 3)
    
    # 计算距离矩阵（ΔE2000）
    distances = []
    for i in range(n_samples):
        row_distances = []
        for j in range(n_samples):
            if i == j:
                row_distances.append(0.0)
            else:
                # ΔE2000计算需要(1,1,3)的形状
                lab1 = lab_vectors[i].reshape(1, 1, 3)
                lab2 = lab_vectors[j].reshape(1, 1, 3)
                de = deltaE_ciede2000(lab1, lab2)[0, 0]
                row_distances.append(de)
        distances.append(row_distances)
    
    distance_matrix = np.array(distances)
    return distance_matrix


@timer
def cluster_images_by_color_de2000(
    lab_vectors: np.ndarray,
    image_paths: List[str],
    n_clusters: int,
    linkage: str = 'ward'
) -> Dict[int, Dict]:
    """
    使用ΔE2000距离进行层次聚类，将图片分成n个颜色类别
    
    参数:
        lab_vectors: LAB向量数组，形状为 (n_samples, 3)
        image_paths: 图片路径列表，长度应与lab_vectors的行数相同
        n_clusters: 聚类数量
        linkage: 链接策略，'ward', 'complete', 'average'等
    
    返回:
        clusters: 字典，格式为 {
            类别ID: {
                'images': [图片路径列表],
                'indices': [图片索引列表],
                'lab_mean': [平均LAB值],
                'lab_std': [LAB标准差],
                'de2000_mean': 类内平均ΔE2000,
                'de2000_max': 类内最大ΔE2000,
                'de2000_std': 类内ΔE2000标准差,
                'count': 类别内图片数量
            }
        }
    """
    n_samples = len(lab_vectors)
    
    if n_samples < n_clusters:
        raise ValueError(f"图片数量({n_samples})少于聚类数量({n_clusters})")
    
    if n_samples == n_clusters:
        # 每个图片单独一类
        clusters = {}
        for i in range(n_samples):
            clusters[i] = {
                'images': [image_paths[i]],
                'indices': [i],
                'lab_mean': lab_vectors[i].tolist(),
                'lab_std': [0.0, 0.0, 0.0],
                'de2000_mean': 0.0,
                'de2000_max': 0.0,
                'de2000_std': 0.0,
                'count': 1
            }
        return clusters
    
    # 计算ΔE2000距离矩阵
    print(f"计算ΔE2000距离矩阵... (样本数: {n_samples})")
    distance_matrix = compute_de2000_distance_matrix(lab_vectors)
    
    # 使用层次聚类（Agglomerative Clustering）
    # 注意：'ward'链接不支持预计算距离矩阵，必须使用欧氏距离
    # 为了严格使用ΔE2000，我们使用'average'或'complete'链接
    if linkage == 'ward':
        print(f"警告: 'ward'链接不支持ΔE2000距离，将使用LAB欧氏距离（近似）")
        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            linkage='ward',
            metric='euclidean'
        )
        clustering.fit(lab_vectors)
    else:
        # 使用预计算的ΔE2000距离矩阵（推荐）
        print(f"使用ΔE2000距离矩阵进行聚类 (linkage={linkage})")
        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            linkage=linkage,
            metric='precomputed'
        )
        clustering.fit(distance_matrix)
    
    labels = clustering.labels_
    
    # 统计每个类别的信息
    clusters = {}
    for cluster_id in range(n_clusters):
        cluster_indices = np.where(labels == cluster_id)[0]
        cluster_lab_vectors = lab_vectors[cluster_indices]
        
        # 计算平均LAB值
        lab_mean = np.mean(cluster_lab_vectors, axis=0).tolist()
        
        # 计算LAB标准差
        lab_std = np.std(cluster_lab_vectors, axis=0).tolist()
        
        # 计算类内ΔE2000统计（每个样本与类别中心的距离）
        cluster_lab_mean_reshaped = np.array(lab_mean).reshape(1, 1, 3)
        de2000_distances = []
        for lab_vec in cluster_lab_vectors:
            lab_vec_reshaped = lab_vec.reshape(1, 1, 3)
            de = deltaE_ciede2000(cluster_lab_mean_reshaped, lab_vec_reshaped)[0, 0]
            de2000_distances.append(de)
        
        de2000_distances = np.array(de2000_distances)
        
        # 计算类内所有样本对之间的ΔE2000（更全面的误差度量）
        if len(cluster_indices) > 1:
            cluster_distances = []
            for i in range(len(cluster_lab_vectors)):
                for j in range(i + 1, len(cluster_lab_vectors)):
                    lab1 = cluster_lab_vectors[i].reshape(1, 1, 3)
                    lab2 = cluster_lab_vectors[j].reshape(1, 1, 3)
                    de = deltaE_ciede2000(lab1, lab2)[0, 0]
                    cluster_distances.append(de)
            
            de2000_mean_all_pairs = np.mean(cluster_distances) if cluster_distances else 0.0
            de2000_max_all_pairs = np.max(cluster_distances) if cluster_distances else 0.0
            de2000_std_all_pairs = np.std(cluster_distances) if cluster_distances else 0.0
        else:
            de2000_mean_all_pairs = 0.0
            de2000_max_all_pairs = 0.0
            de2000_std_all_pairs = 0.0
        
        clusters[cluster_id] = {
            'images': [image_paths[idx] for idx in cluster_indices],
            'indices': cluster_indices.tolist(),
            'lab_mean': lab_mean,  # 类别平均LAB值（可作为基准）
            'lab_std': lab_std,  # LAB标准差（误差范围）
            'de2000_mean': float(np.mean(de2000_distances)),  # 与中心的平均ΔE2000
            'de2000_max': float(np.max(de2000_distances)),  # 与中心的最大ΔE2000
            'de2000_std': float(np.std(de2000_distances)),  # 与中心的ΔE2000标准差
            'de2000_intra_mean': float(de2000_mean_all_pairs),  # 类内所有对平均ΔE2000
            'de2000_intra_max': float(de2000_max_all_pairs),  # 类内所有对最大ΔE2000
            'count': len(cluster_indices)
        }
    
    return clusters


@timer
def calculate_inter_cluster_distance(clusters: Dict[int, Dict]) -> Dict[str, float]:
    """
    计算类间距离统计（不同类别之间的ΔE2000）
    
    参数:
        clusters: 聚类结果字典
    
    返回:
        类间距离统计信息
    """
    cluster_ids = list(clusters.keys())
    n_clusters = len(cluster_ids)
    
    if n_clusters < 2:
        return {
            'mean': 0.0,
            'min': 0.0,
            'max': 0.0,
            'std': 0.0
        }
    
    inter_distances = []
    for i in range(n_clusters):
        for j in range(i + 1, n_clusters):
            lab_mean_i = np.array(clusters[i]['lab_mean']).reshape(1, 1, 3)
            lab_mean_j = np.array(clusters[j]['lab_mean']).reshape(1, 1, 3)
            de = deltaE_ciede2000(lab_mean_i, lab_mean_j)[0, 0]
            inter_distances.append(de)
    
    inter_distances = np.array(inter_distances)
    
    return {
        'mean': float(np.mean(inter_distances)),
        'min': float(np.min(inter_distances)),
        'max': float(np.max(inter_distances)),
        'std': float(np.std(inter_distances))
    }


if __name__ == "__main__":
    # 示例使用
    pass

