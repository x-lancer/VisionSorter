"""
生成指定基础色的同色系变体图片
在HSV颜色空间中，基于基础色生成色相、饱和度、亮度的随机变体
例如：红色、洋红色、鲜红色、深红色等各种红色系变体
"""

import cv2
import numpy as np
from typing import Optional, Tuple, List
import os
import uuid
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading


def create_circular_mask(size: int, center: Tuple[int, int], radius: int) -> np.ndarray:
    """创建圆形掩码"""
    y, x = np.ogrid[:size, :size]
    mask = (x - center[0]) ** 2 + (y - center[1]) ** 2 <= radius ** 2
    return mask.astype(np.uint8) * 255


def bgr_to_hsv(bgr_color: Tuple[int, int, int]) -> Tuple[int, int, int]:
    """将BGR颜色转换为HSV"""
    bgr_array = np.array([[bgr_color]], dtype=np.uint8)
    hsv_array = cv2.cvtColor(bgr_array, cv2.COLOR_BGR2HSV)
    return tuple(hsv_array[0, 0])


def hsv_to_bgr(hsv_color: Tuple[int, int, int]) -> Tuple[int, int, int]:
    """将HSV颜色转换为BGR"""
    hsv_array = np.array([[hsv_color]], dtype=np.uint8)
    bgr_array = cv2.cvtColor(hsv_array, cv2.COLOR_HSV2BGR)
    return tuple(bgr_array[0, 0])


def generate_color_variant(
    base_hsv: Tuple[int, int, int],
    hue_variance: float = 15.0,  # 色相偏差范围（度）
    saturation_variance: float = 0.2,  # 饱和度偏差范围（0-1）
    value_variance: float = 0.3,  # 亮度偏差范围（0-1）
    min_saturation: float = 0.3,  # 最小饱和度
    max_saturation: float = 1.0,  # 最大饱和度
    min_value: float = 0.2,  # 最小亮度
    max_value: float = 0.95  # 最大亮度
) -> Tuple[int, int, int]:
    """
    基于基础HSV颜色生成一个变体（同色系）
    
    参数:
        base_hsv: 基础HSV颜色 (H: 0-179, S: 0-255, V: 0-255)
        hue_variance: 色相偏差范围（度），默认±15度
        saturation_variance: 饱和度偏差范围，默认±0.2
        value_variance: 亮度偏差范围，默认±0.3
        min_saturation: 最小饱和度（0-1）
        max_saturation: 最大饱和度（0-1）
        min_value: 最小亮度（0-1）
        max_value: 最大亮度（0-1）
    
    返回:
        变体的HSV颜色
    """
    h_base, s_base, v_base = base_hsv
    
    # 归一化S和V到0-1范围
    s_norm = s_base / 255.0
    v_norm = v_base / 255.0
    
    # 1. 色相偏差（在基础色相周围随机偏移）
    hue_offset = np.random.uniform(-hue_variance, hue_variance)
    h_new = (h_base + hue_offset) % 180  # HSV的H范围是0-179
    
    # 2. 饱和度偏差（可以更鲜艳或更淡）
    saturation_offset = np.random.uniform(-saturation_variance, saturation_variance)
    s_new = np.clip(s_norm + saturation_offset, min_saturation, max_saturation)
    s_new = int(s_new * 255)
    
    # 3. 亮度偏差（可以更亮或更暗）
    value_offset = np.random.uniform(-value_variance, value_variance)
    v_new = np.clip(v_norm + value_offset, min_value, max_value)
    v_new = int(v_new * 255)
    
    return (int(h_new), s_new, v_new)


def generate_3d_bead(
    size: int = 200,
    diameter: int = 200,
    base_color: Optional[Tuple[int, int, int]] = None,
    highlight_intensity: float = 0.8,
    shadow_intensity: float = 0.3
) -> np.ndarray:
    """
    生成有立体感的珠子图片
    
    参数:
        size: 图片尺寸
        diameter: 圆形直径
        base_color: 基础颜色 (B, G, R)，如果为None则随机生成
        highlight_intensity: 高光强度 (0-1)
        shadow_intensity: 阴影强度 (0-1)
    
    返回:
        生成的图片 (BGR格式)
    """
    # 创建白色背景
    image = np.ones((size, size, 3), dtype=np.float32) * 255.0
    
    if base_color is None:
        base_color = (
            np.random.randint(30, 226),
            np.random.randint(30, 226),
            np.random.randint(30, 226)
        )
    
    base_color_float = np.array(base_color, dtype=np.float32)
    center = (size // 2, size // 2)
    radius = diameter // 2
    mask = create_circular_mask(size, center, radius)
    
    y_coords, x_coords = np.ogrid[:size, :size]
    dist_from_center = np.sqrt((x_coords - center[0]) ** 2 + (y_coords - center[1]) ** 2)
    normalized_dist = np.clip(dist_from_center / radius, 0, 1)
    
    # 径向渐变
    gradient_factor = 1.0 - normalized_dist * 0.3
    gradient_color = base_color_float[np.newaxis, np.newaxis, :] * gradient_factor[:, :, np.newaxis]
    
    # 球面光照
    light_angle_x = 0.3
    light_angle_y = -0.5
    x_norm = (x_coords - center[0]) / radius
    y_norm = (y_coords - center[1]) / radius
    z_norm = np.sqrt(np.maximum(0, 1 - x_norm**2 - y_norm**2))
    
    light_dir = np.array([light_angle_x, light_angle_y, 0.8])
    light_dir = light_dir / np.linalg.norm(light_dir)
    
    dot_product = (x_norm * light_dir[0] + y_norm * light_dir[1] + z_norm * light_dir[2])
    lighting = np.clip(dot_product * 0.5 + 0.5, 0.2, 1.0)
    lit_color = gradient_color * lighting[:, :, np.newaxis]
    
    # 高光
    highlight_center_x = center[0] + int(radius * 0.3)
    highlight_center_y = center[1] - int(radius * 0.4)
    highlight_radius = radius * 0.25
    
    dist_to_highlight = np.sqrt(
        (x_coords - highlight_center_x) ** 2 + 
        (y_coords - highlight_center_y) ** 2
    )
    
    highlight_factor = np.exp(-(dist_to_highlight ** 2) / (2 * (highlight_radius * 0.5) ** 2))
    highlight_factor = highlight_factor * highlight_intensity
    
    highlight_color = np.array([255.0, 255.0, 255.0], dtype=np.float32)
    highlight_boost = highlight_color[np.newaxis, np.newaxis, :] * highlight_factor[:, :, np.newaxis]
    highlight_mask_3d = highlight_factor[:, :, np.newaxis]
    lit_color = lit_color * (1 - highlight_mask_3d) + highlight_boost * highlight_mask_3d
    
    # 阴影
    shadow_start_y = center[1] + radius * 0.3
    y_grid, x_grid = np.mgrid[0:size, 0:size]
    shadow_y_coords = y_grid - shadow_start_y
    
    shadow_mask = (shadow_y_coords > 0) & (shadow_y_coords < radius * 0.6)
    shadow_factor = np.ones((size, size), dtype=np.float32)
    shadow_factor[shadow_mask] = 1.0 - (shadow_y_coords[shadow_mask] / (radius * 0.6)) * shadow_intensity
    shadow_factor = np.clip(shadow_factor, 1.0 - shadow_intensity, 1.0)
    
    lit_color = lit_color * shadow_factor[:, :, np.newaxis]
    lit_color = lit_color * (mask[:, :, np.newaxis] / 255.0)
    background_mask = (1 - mask[:, :, np.newaxis] / 255.0)
    image = image * background_mask + lit_color * (1 - background_mask)
    
    # 底部投影
    shadow_offset_x = 3
    shadow_offset_y = radius * 0.7
    shadow_center = (center[0] + shadow_offset_x, center[1] + shadow_offset_y)
    shadow_radius = radius * 0.6
    shadow_ellipse_mask = np.zeros((size, size), dtype=np.float32)
    
    for y in range(size):
        for x in range(size):
            dist_x = (x - shadow_center[0]) / shadow_radius
            dist_y = (y - shadow_center[1]) / (shadow_radius * 0.5)
            if dist_x**2 + dist_y**2 <= 1.0:
                shadow_dist = np.sqrt(dist_x**2 + dist_y**2)
                shadow_value = np.exp(-shadow_dist * 3) * shadow_intensity * 0.3
                shadow_ellipse_mask[y, x] = shadow_value
    
    shadow_on_bg = shadow_ellipse_mask * (1 - mask / 255.0)
    image = image * (1 - shadow_on_bg[:, :, np.newaxis]) + \
            (image * (1 - shadow_on_bg[:, :, np.newaxis]) * 0.7)
    
    image = np.clip(image, 0, 255).astype(np.uint8)
    return image


def generate_color_variants(
    base_color_bgr: Tuple[int, int, int],
    num_variants: int = 20,
    hue_variance: float = 15.0,
    saturation_variance: float = 0.25,
    value_variance: float = 0.35,
    output_dir: str = "generated_variants",
    size: int = 200,
    diameter: int = 200,
    prefix: Optional[str] = None,
    num_threads: int = 10
) -> List[str]:
    """
    基于指定基础色生成同色系的多种变体
    
    参数:
        base_color_bgr: 基础颜色 (B, G, R)，例如红色 (0, 0, 255)
        num_variants: 生成变体数量，默认20
        hue_variance: 色相偏差范围（度），默认±15度
        saturation_variance: 饱和度偏差范围，默认±0.25
        value_variance: 亮度偏差范围，默认±0.35
        output_dir: 输出目录
        size: 图片尺寸
        diameter: 圆形直径
        prefix: 文件名前缀
        num_threads: 线程数量
    
    返回:
        生成的文件路径列表
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 将基础色转换为HSV
    base_hsv = bgr_to_hsv(base_color_bgr)
    print(f"基础颜色 BGR: {base_color_bgr}")
    print(f"基础颜色 HSV: H={base_hsv[0]}, S={base_hsv[1]}, V={base_hsv[2]}")
    print(f"生成 {num_variants} 种同色系变体...\n")
    
    print_lock = threading.Lock()
    generated_files = []
    file_lock = threading.Lock()
    
    def _generate_single_variant(index: int) -> str:
        """生成单个变体"""
        try:
            # 生成HSV变体
            variant_hsv = generate_color_variant(
                base_hsv,
                hue_variance=hue_variance,
                saturation_variance=saturation_variance,
                value_variance=value_variance
            )
            
            # 转换回BGR
            variant_bgr = hsv_to_bgr(variant_hsv)
            
            # 生成3D立体珠子
            image = generate_3d_bead(
                size=size,
                diameter=diameter,
                base_color=variant_bgr,
                highlight_intensity=0.7 + np.random.random() * 0.2,
                shadow_intensity=0.2 + np.random.random() * 0.1
            )
            
            # 生成文件名
            if prefix:
                filename = f"{prefix}_variant_{index+1:04d}.png"
            else:
                unique_id = str(uuid.uuid4())[:8]
                filename = f"variant_{unique_id}.png"
            
            output_path = os.path.join(output_dir, filename)
            cv2.imwrite(output_path, image)
            
            with print_lock:
                print(f"生成: {output_path}")
                print(f"  HSV: H={variant_hsv[0]:3d}, S={variant_hsv[1]:3d}, V={variant_hsv[2]:3d} | "
                      f"BGR: {variant_bgr}")
            
            with file_lock:
                generated_files.append(output_path)
            
            return output_path
        except Exception as e:
            with print_lock:
                print(f"生成失败 (index={index}): {e}")
            return ""
    
    # 使用线程池并行生成
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = {
            executor.submit(_generate_single_variant, i): i
            for i in range(num_variants)
        }
        
        completed = 0
        for future in as_completed(futures):
            try:
                result = future.result()
                completed += 1
                if completed % 50 == 0:
                    with print_lock:
                        print(f"\n进度: {completed}/{num_variants} ({completed*100//num_variants}%)\n")
            except Exception as e:
                index = futures[future]
                with print_lock:
                    print(f"任务失败 (index={index}): {e}")
    
    print(f"\n总共生成 {num_variants} 张同色系变体图片，保存在目录: {output_dir}")
    
    return generated_files


if __name__ == "__main__":
    # 示例1: 生成红色系变体（红色、洋红色、鲜红色、深红色等）
    # print("=" * 60)
    # print("生成红色系变体")
    # print("=" * 60)
    # generate_color_variants(
    #     base_color_bgr=(0, 0, 255),  # 红色 (B, G, R)
    #     num_variants=1000,
    #     hue_variance=20.0,  # 色相偏差±20度（可以生成红色到洋红色之间的变体）
    #     saturation_variance=0.3,  # 饱和度偏差±0.3（可以生成鲜艳到淡色的变体）
    #     value_variance=0.4,  # 亮度偏差±0.4（可以生成亮到暗的变体）
    #     output_dir=r"D:\Workspace\VisionSorter\samples\Validation_RED",
    #     prefix="red_variant",
    #     num_threads=10
    # )
    
    # 示例2: 生成蓝色系变体
    # print("\n" + "=" * 60)
    # print("生成蓝色系变体")
    # print("=" * 60)
    # generate_color_variants(
    #     base_color_bgr=(255, 0, 0),  # 蓝色
    #     num_variants=25,
    #     hue_variance=18.0,
    #     saturation_variance=0.25,
    #     value_variance=0.35,
    #     output_dir="generated_variants_blue",
    #     prefix="blue_variant",
    #     num_threads=10
    # )
    
    # 示例3: 生成绿色系变体
    # print("\n" + "=" * 60)
    # print("生成绿色系变体")
    # print("=" * 60)
    generate_color_variants(
        base_color_bgr=(74, 140, 30),  # 绿色
        num_variants=100,
        hue_variance=15.0,
        saturation_variance=0.3,
        value_variance=0.4,
        output_dir=r"D:\Workspace\VisionSorter\samples\Basic_GREEN",
        prefix="green_variant",
        num_threads=10
    )

    # 示例4: 生成棕色系变体
    # print("\n" + "=" * 60)
    # print("生成绿色系变体")
    # print("=" * 60)
    # generate_color_variants(
    #     base_color_bgr=(200, 146, 42),  # 绿色
    #     num_variants=1000,
    #     hue_variance=15.0,
    #     saturation_variance=0.3,
    #     value_variance=0.4,
    #     output_dir=r"D:\Workspace\VisionSorter\samples\Validation_BROWN",
    #     prefix="brown_variant",
    #     num_threads=10
    # )
