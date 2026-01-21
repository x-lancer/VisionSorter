"""
图片处理工具函数
"""

import cv2
import numpy as np
from typing import Optional
from skimage.color import rgb2lab
from utils.decorator import timer


@timer
def detect_highlight_regions(
    image: np.ndarray,
    mask: Optional[np.ndarray] = None,
    threshold_l: float = 85,
    threshold_saturation: int = 30
) -> np.ndarray:
    """
    检测图像中的高光区域
    
    参数:
        image: BGR格式图像
        mask: 珠子区域的掩码
        threshold_l: LAB空间中L值的阈值（>此值认为是高光）
        threshold_saturation: HSV空间中饱和度阈值（<此值且亮度高，更可能是高光）
    
    返回:
        highlight_mask: 高光区域的掩码（255=高光，0=非高光）
    """
    if mask is None:
        h, w = image.shape[:2]
        mask = np.ones((h, w), dtype=np.uint8) * 255
    
    # 方法1: 基于LAB空间的亮度L值
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    lab_image = rgb2lab(rgb_image)
    L_channel = lab_image[:, :, 0]
    
    # 方法2: 基于HSV空间的饱和度和亮度（高光通常是高亮度+低饱和度）
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    h, s, v = cv2.split(hsv)
    
    # 组合判断：L值很高 或 (亮度很高且饱和度很低)
    highlight_mask_l = (L_channel > threshold_l).astype(np.uint8) * 255
    highlight_mask_hsv = ((v > 240) & (s < threshold_saturation)).astype(np.uint8) * 255
    
    # 合并两种方法
    highlight_mask = cv2.bitwise_or(highlight_mask_l, highlight_mask_hsv)
    
    # 只保留mask区域内的
    highlight_mask = cv2.bitwise_and(highlight_mask, mask)
    
    return highlight_mask


@timer
def extract_center_region(mask: np.ndarray, ratio: float = 0.4) -> np.ndarray:
    """
    提取mask的中心区域（圆形，半径为等效圆半径的ratio倍）
    
    参数:
        mask: 二值掩码图像
        ratio: 中心区域半径比例，默认0.4（即40%）
    
    返回:
        center_mask: 中心区域的掩码
    """
    # 计算质心
    M = cv2.moments(mask)
    if M["m00"] == 0:
        return mask
    
    cx = int(M["m10"] / M["m00"])
    cy = int(M["m01"] / M["m00"])
    
    # 计算等效圆半径
    area = np.sum(mask > 0)
    radius = int(np.sqrt(area / np.pi) * ratio)
    
    # 创建圆形mask
    center_mask = np.zeros_like(mask)
    cv2.circle(center_mask, (cx, cy), radius, 255, -1)
    
    # 与原始mask取交集
    return cv2.bitwise_and(mask, center_mask)


@timer
def bgr_to_lab(image: np.ndarray) -> np.ndarray:
    """
    将BGR格式图像转换为LAB颜色空间
    
    参数:
        image: BGR格式的OpenCV图像
    
    返回:
        lab_image: LAB颜色空间图像 (L: 0-100, a/b: -127到127)
    """
    # 转换为RGB（OpenCV默认BGR，需要转RGB再转LAB）
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    # 转换为LAB颜色空间（使用skimage，它的LAB值范围正确）
    lab_image = rgb2lab(rgb_image)
    return lab_image


@timer
def extract_lab_from_mask(
    lab_image: np.ndarray,
    mask: np.ndarray,
    use_median: bool = True
) -> np.ndarray:
    """
    从LAB图像中根据mask提取LAB向量
    
    参数:
        lab_image: LAB颜色空间图像
        mask: 二值掩码（255表示有效区域）
        use_median: True使用中值（抗高光），False使用均值
    
    返回:
        lab_vector: [L, a, b] 三个值的numpy数组
    """
    # 提取mask区域的LAB值
    masked_lab = lab_image[mask > 0]
    
    if len(masked_lab) == 0:
        return np.array([50.0, 0.0, 0.0])  # 默认中性灰
    
    # 计算LAB向量（中值或均值）
    if use_median:
        lab_vector = np.median(masked_lab, axis=0)  # 抗高光干扰
    else:
        lab_vector = np.mean(masked_lab, axis=0)
    
    return lab_vector


@timer
def extract_lab_from_image(
    image_path: str,
    center_ratio: float = 0.4,
    use_median: bool = True
) -> np.ndarray:
    """
    从图片文件中读取图像并提取中心区域的LAB向量。
    
    参数:
        image_path: 图片文件路径
        center_ratio: 中心区域半径比例，默认0.4（即40%）
        use_median: 是否使用中值（抗高光），默认True
    
    返回:
        lab_vector: [L, a, b] 三个值的numpy数组
    """
    # 读取图像（BGR）
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    h, w = image.shape[:2]
    # 创建全图mask
    mask = np.ones((h, w), dtype=np.uint8) * 255
    
    # 提取中心区域mask
    center_mask = extract_center_region(mask, ratio=center_ratio)
    
    # 转换到LAB空间
    lab_image = bgr_to_lab(image)
    
    # 根据mask提取LAB向量
    lab_vector = extract_lab_from_mask(lab_image, center_mask, use_median=use_median)
    
    return lab_vector

