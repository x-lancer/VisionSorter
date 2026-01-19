"""
珠子颜色相似度计算 - 使用CIELAB颜色空间
核心答案：计算图片中珠子的 LAB 值，然后使用 ΔE 度量色差
"""

import cv2
import numpy as np
from skimage.color import deltaE_cie76, deltaE_ciede94, deltaE_ciede2000
from utils.decorator import timer
from utils.imgtool import detect_highlight_regions, extract_center_region, bgr_to_lab, extract_lab_from_mask




@timer
def extract_bead_lab_vector(image, mask=None, use_median=True, center_weighted=True, 
                            exclude_highlight=True, highlight_threshold_l=85):
    """
    从图片中提取珠子的LAB颜色特征向量
    
    参数:
        image: BGR格式的OpenCV图像 (numpy array)
        mask: 可选，珠子的掩码（二值图，255表示珠子区域）
        use_median: True使用中值（抗高光），False使用均值
        center_weighted: True则只使用中心区域（40%半径）
        exclude_highlight: True则明确排除高光区域，False仅依赖中值抗高光
        highlight_threshold_l: LAB空间中L值阈值，超过此值认为是高光
    
    返回:
        lab_vector: [L, a, b] 三个值的numpy数组
            - L: 亮度 (0-100)
            - a: 红绿轴 (-127到127)
            - b: 黄蓝轴 (-127到127)
        highlight_ratio: 高光区域占比（用于诊断）
    """
    # 1. 如果没有提供mask，需要先分割珠子（这里简化处理）
    if mask is None:
        # 简单分割：假设珠子在图像中心，或使用其他分割方法
        h, w = image.shape[:2]
        mask = np.ones((h, w), dtype=np.uint8) * 255
    
    # 2. 如果启用中心加权，只取中心区域
    original_mask = mask.copy()
    if center_weighted:
        mask = extract_center_region(mask, ratio=0.4)
    
    # 3. 检测并排除高光区域（如果启用）
    highlight_mask = None
    highlight_ratio = 0.0
    if exclude_highlight:
        highlight_mask = detect_highlight_regions(image, mask, threshold_l=highlight_threshold_l)
        # 从mask中排除高光区域
        mask = cv2.bitwise_and(mask, cv2.bitwise_not(highlight_mask))
        
        # 计算高光占比（用于诊断）
        mask_area = np.sum(original_mask > 0)
        if mask_area > 0:
            highlight_area = np.sum(highlight_mask > 0)
            highlight_ratio = highlight_area / mask_area
    
    # 4. 转换为LAB颜色空间
    lab_image = bgr_to_lab(image)
    
    # 5. 检查mask是否为空（所有区域都被高光占据）
    mask_area = np.sum(mask > 0)
    if mask_area == 0:
        # 如果所有区域都被高光占据，使用原始mask但警告
        print("警告: 所有区域都被识别为高光，使用全部区域计算")
        lab_vector = extract_lab_from_mask(lab_image, original_mask, use_median=use_median)
    else:
        # 提取mask区域的LAB向量（已排除高光）
        lab_vector = extract_lab_from_mask(lab_image, mask, use_median=use_median)
    
    return lab_vector, highlight_ratio


@timer
def calculate_color_difference(lab1, lab2, method='cie2000'):
    """
    计算两个LAB颜色之间的色差（ΔE）
    
    参数:
        lab1: 第一个颜色的LAB向量 [L, a, b]
        lab2: 第二个颜色的LAB向量 [L, a, b]
        method: 计算方法
            - 'cie76': 欧氏距离，计算快但精度较低
            - 'cie94': 改进版，平衡精度和速度
            - 'cie2000': 最精确，最接近人眼感知（推荐）
    
    返回:
        delta_e: 色差值（数值越大，差异越大）
            - ΔE < 1: 人眼几乎无法察觉差异
            - 1 < ΔE < 3: 训练有素的观察者能察觉
            - 3 < ΔE < 6: 普通观察者能察觉
            - ΔE > 6: 明显差异
    """
    # 确保是2D数组（skimage要求）
    lab1 = lab1.reshape(1, 1, 3)
    lab2 = lab2.reshape(1, 1, 3)
    
    if method == 'cie76':
        return deltaE_cie76(lab1, lab2)[0, 0]
    elif method == 'cie94':
        return deltaE_ciede94(lab1, lab2)[0, 0]
    elif method == 'cie2000':
        return deltaE_ciede2000(lab1, lab2)[0, 0]
    else:
        raise ValueError(f"Unknown method: {method}")


@timer
def compare_bead_images(image1, image2, mask1=None, mask2=None, 
                        exclude_highlight=True, highlight_threshold_l=85):
    """
    比较两张珠子图片的颜色相似度
    
    参数:
        exclude_highlight: 是否排除高光区域
        highlight_threshold_l: LAB空间L值阈值，超过此值认为是高光
    
    返回:
        result: dict包含
            - lab1: 第一颗珠子的LAB值
            - lab2: 第二颗珠子的LAB值
            - delta_e76: ΔE76色差
            - delta_e94: ΔE94色差
            - delta_e2000: ΔE2000色差（最推荐）
            - similarity_score: 相似度分数 (0-1，1表示完全相同)
            - highlight_ratio1: 第一颗珠子的高光占比
            - highlight_ratio2: 第二颗珠子的高光占比
    """
    # 提取LAB向量
    lab1, highlight_ratio1 = extract_bead_lab_vector(image1, mask1, 
                                                     exclude_highlight=exclude_highlight,
                                                     highlight_threshold_l=highlight_threshold_l)
    lab2, highlight_ratio2 = extract_bead_lab_vector(image2, mask2,
                                                     exclude_highlight=exclude_highlight,
                                                     highlight_threshold_l=highlight_threshold_l)
    
    # 计算各种ΔE
    de76 = calculate_color_difference(lab1, lab2, 'cie76')
    de94 = calculate_color_difference(lab1, lab2, 'cie94')
    de2000 = calculate_color_difference(lab1, lab2, 'cie2000')
    
    # 计算相似度分数（基于ΔE2000，阈值设为10）
    # ΔE=0时相似度=1，ΔE≥10时相似度=0
    similarity = max(0, 1 - (de2000 / 10.0))
    
    return {
        'lab1': lab1,
        'lab2': lab2,
        'delta_e76': de76,
        'delta_e94': de94,
        'delta_e2000': de2000,
        'similarity_score': similarity,
        'is_similar': de2000 < 10.0,  # 阈值可根据需求调整
        'highlight_ratio1': highlight_ratio1,  # 高光占比（0-1）
        'highlight_ratio2': highlight_ratio2
    }


# ============================================================================
# 使用示例
# ============================================================================

if __name__ == "__main__":
    import time
    t1 = time.time()
    # 示例1: 读取两张珠子图片并比较
    img1_path = r"D:\Workspace\VisionSorter\samples\Validation_GREEN\green_variant_variant_0002.png"
    img2_path = r"D:\Workspace\VisionSorter\samples\Validation_GREEN\green_variant_variant_0001.png"
    # img2_path = "sample/IMG_20260113_151856.jpg"
    
    img1 = cv2.imread(img1_path)
    img2 = cv2.imread(img2_path)
    
    if img1 is not None and img2 is not None:
        result = compare_bead_images(img1, img2)
        
        print("=" * 60)
        print("珠子颜色相似度分析结果")
        print("=" * 60)
        print(f"珠子1 LAB值: L={result['lab1'][0]:.2f}, a={result['lab1'][1]:.2f}, b={result['lab1'][2]:.2f}")
        print(f"珠子2 LAB值: L={result['lab2'][0]:.2f}, a={result['lab2'][1]:.2f}, b={result['lab2'][2]:.2f}")
        print("-" * 60)
        print(f"ΔE76 (欧氏距离):   {result['delta_e76']:.3f}")
        print(f"ΔE94 (改进版):      {result['delta_e94']:.3f}")
        print(f"ΔE2000 (最精确):    {result['delta_e2000']:.3f} ⭐推荐")
        print("-" * 60)
        print(f"相似度分数: {result['similarity_score']:.3f} (0=完全不同, 1=完全相同)")
        print(f"是否相似: {'是' if result['is_similar'] else '否'} (阈值ΔE<10)")
        print("-" * 60)
        print(f"高光占比 - 珠子1: {result['highlight_ratio1']*100:.1f}%, 珠子2: {result['highlight_ratio2']*100:.1f}%")
        print("=" * 60)
        
        # 解释ΔE值
        de = result['delta_e2000']
        if de < 1:
            interpretation = "人眼几乎无法察觉差异"
        elif de < 3:
            interpretation = "训练有素的观察者能察觉差异"
        elif de < 6:
            interpretation = "普通观察者能察觉差异"
        else:
            interpretation = "明显差异"
        print(f"ΔE2000={de:.3f}: {interpretation}")
    else:
        print("错误: 无法读取图片文件")

    print(time.time()-t1)