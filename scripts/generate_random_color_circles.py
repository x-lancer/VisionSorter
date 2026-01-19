"""
生成随机颜色的立体感圆形图片
生成n张 200x200 分辨率，中间是直径200的随机颜色圆形的PNG图片
包含：径向渐变、高光、阴影等立体效果
支持多线程并行生成
"""

import cv2
import numpy as np
from typing import Optional, Tuple
import os
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading


def create_circular_mask(size: int, center: Tuple[int, int], radius: int) -> np.ndarray:
    """创建圆形掩码"""
    y, x = np.ogrid[:size, :size]
    mask = (x - center[0]) ** 2 + (y - center[1]) ** 2 <= radius ** 2
    return mask.astype(np.uint8) * 255


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
    
    # 生成随机基础颜色
    if base_color is None:
        base_color = (
            np.random.randint(30, 226),  # B (避免过暗)
            np.random.randint(30, 226),  # G
            np.random.randint(30, 226)   # R
        )
    
    # 转换为浮点数便于计算
    base_color_float = np.array(base_color, dtype=np.float32)
    
    center = (size // 2, size // 2)
    radius = diameter // 2
    
    # 创建圆形掩码
    mask = create_circular_mask(size, center, radius)
    
    # 创建坐标网格
    y_coords, x_coords = np.ogrid[:size, :size]
    
    # 计算每个像素到圆心的距离
    dist_from_center = np.sqrt((x_coords - center[0]) ** 2 + (y_coords - center[1]) ** 2)
    
    # 归一化距离 (0-1，圆心为0，边缘为1)
    normalized_dist = np.clip(dist_from_center / radius, 0, 1)
    
    # 1. 径向渐变（中心较亮，边缘较暗）
    gradient_factor = 1.0 - normalized_dist * 0.3  # 边缘比中心暗30%
    gradient_color = base_color_float[np.newaxis, np.newaxis, :] * gradient_factor[:, :, np.newaxis]
    
    # 2. 添加球面光照效果（模拟3D球体）
    # 计算光照角度（从右上方向）
    light_angle_x = 0.3  # 光源x偏移
    light_angle_y = -0.5  # 光源y偏移（从上方）
    
    # 计算球面法向量（假设球体在图像平面内）
    x_norm = (x_coords - center[0]) / radius
    y_norm = (y_coords - center[1]) / radius
    
    # 计算z分量（球面高度）
    z_norm = np.sqrt(np.maximum(0, 1 - x_norm**2 - y_norm**2))
    
    # 光照强度计算（点积）
    light_dir = np.array([light_angle_x, light_angle_y, 0.8])
    light_dir = light_dir / np.linalg.norm(light_dir)
    
    normal_x = x_norm
    normal_y = y_norm
    normal_z = z_norm
    
    # 计算光照强度
    dot_product = (normal_x * light_dir[0] + normal_y * light_dir[1] + normal_z * light_dir[2])
    lighting = np.clip(dot_product * 0.5 + 0.5, 0.2, 1.0)  # 0.2到1.0的范围
    
    # 应用光照
    lit_color = gradient_color * lighting[:, :, np.newaxis]
    
    # 3. 添加高光区域（模拟强反射）
    highlight_center_x = center[0] + int(radius * 0.3)  # 高光偏右上方
    highlight_center_y = center[1] - int(radius * 0.4)
    highlight_radius = radius * 0.25  # 高光半径
    
    dist_to_highlight = np.sqrt(
        (x_coords - highlight_center_x) ** 2 + 
        (y_coords - highlight_center_y) ** 2
    )
    
    # 高光衰减（高斯衰减）
    highlight_factor = np.exp(-(dist_to_highlight ** 2) / (2 * (highlight_radius * 0.5) ** 2))
    highlight_factor = highlight_factor * highlight_intensity
    
    # 高光颜色（偏白色）
    highlight_color = np.array([255.0, 255.0, 255.0], dtype=np.float32)
    highlight_boost = highlight_color[np.newaxis, np.newaxis, :] * highlight_factor[:, :, np.newaxis]
    highlight_mask_3d = highlight_factor[:, :, np.newaxis]
    lit_color = lit_color * (1 - highlight_mask_3d) + highlight_boost * highlight_mask_3d
    
    # 4. 添加阴影（底部边缘）
    shadow_start_y = center[1] + radius * 0.3  # 阴影从下半部分开始
    # 创建完整的2D坐标网格
    y_grid, x_grid = np.mgrid[0:size, 0:size]
    shadow_y_coords = y_grid - shadow_start_y
    
    shadow_mask = (shadow_y_coords > 0) & (shadow_y_coords < radius * 0.6)
    
    # 阴影渐变
    shadow_factor = np.ones((size, size), dtype=np.float32)
    shadow_factor[shadow_mask] = 1.0 - (shadow_y_coords[shadow_mask] / (radius * 0.6)) * shadow_intensity
    shadow_factor = np.clip(shadow_factor, 1.0 - shadow_intensity, 1.0)
    
    # 应用阴影
    lit_color = lit_color * shadow_factor[:, :, np.newaxis]
    
    # 应用圆形掩码（确保只有圆形区域有颜色）
    lit_color = lit_color * (mask[:, :, np.newaxis] / 255.0)
    
    # 在掩码外的区域保持白色背景
    background_mask = (1 - mask[:, :, np.newaxis] / 255.0)
    image = image * background_mask + lit_color * (1 - background_mask)
    
    # 5. 添加底部投影阴影（在珠子外的背景上）
    shadow_offset_x = 3
    shadow_offset_y = radius * 0.7
    shadow_center = (center[0] + shadow_offset_x, center[1] + shadow_offset_y)
    shadow_radius = radius * 0.6
    shadow_ellipse_mask = np.zeros((size, size), dtype=np.float32)
    
    # 创建椭圆形阴影掩码
    for y in range(size):
        for x in range(size):
            dist_x = (x - shadow_center[0]) / shadow_radius
            dist_y = (y - shadow_center[1]) / (shadow_radius * 0.5)
            if dist_x**2 + dist_y**2 <= 1.0:
                # 椭圆衰减
                shadow_dist = np.sqrt(dist_x**2 + dist_y**2)
                shadow_value = np.exp(-shadow_dist * 3) * shadow_intensity * 0.3
                shadow_ellipse_mask[y, x] = shadow_value
    
    # 只在背景区域（非珠子区域）添加阴影
    shadow_on_bg = shadow_ellipse_mask * (1 - mask / 255.0)
    image = image * (1 - shadow_on_bg[:, :, np.newaxis]) + \
            (image * (1 - shadow_on_bg[:, :, np.newaxis]) * 0.7)
    
    # 转换为uint8
    image = np.clip(image, 0, 255).astype(np.uint8)
    
    return image


def _generate_single_image(
    output_dir: str,
    index: int,
    size: int,
    diameter: int,
    prefix: Optional[str],
    use_3d: bool,
    lock: threading.Lock
) -> str:
    """
    生成单张图片（用于多线程）
    
    参数:
        output_dir: 输出目录
        index: 图片索引
        size: 图片尺寸
        diameter: 圆形直径
        prefix: 文件名前缀
        use_3d: 是否使用3D效果
        lock: 线程锁（用于同步打印）
    
    返回:
        生成的文件路径
    """
    try:
        if use_3d:
            # 使用3D立体效果
            image = generate_3d_bead(
                size=size,
                diameter=diameter,
                base_color=None,  # 随机颜色
                highlight_intensity=0.7 + np.random.random() * 0.2,  # 0.7-0.9
                shadow_intensity=0.2 + np.random.random() * 0.1  # 0.2-0.3
            )
        else:
            # 简单版本（平面圆形）
            image = np.ones((size, size, 3), dtype=np.uint8) * 255
            color = (
                np.random.randint(0, 256),
                np.random.randint(0, 256),
                np.random.randint(0, 256)
            )
            center = (size // 2, size // 2)
            radius = diameter // 2
            cv2.circle(image, center, radius, color, -1)
        
        # 生成文件名
        if prefix:
            filename = f"{prefix}_{index+1:04d}.png"
        else:
            unique_id = str(uuid.uuid4())[:8]
            filename = f"circle_{unique_id}.png"
        
        # 保存图片
        output_path = os.path.join(output_dir, filename)
        cv2.imwrite(output_path, image)
        
        with lock:
            print(f"生成: {output_path}")
        
        return output_path
    except Exception as e:
        with lock:
            print(f"生成图片失败 (index={index}): {e}")
        return ""


def generate_random_color_circle(
    output_dir: str = "generated_circles",
    num_images: int = 10,
    size: int = 200,
    diameter: int = 200,
    prefix: Optional[str] = None,
    use_3d: bool = True,
    num_threads: int = 10
) -> None:
    """
    生成随机颜色的圆形图片（带立体感，支持多线程）
    
    参数:
        output_dir: 输出目录，默认 "generated_circles"
        num_images: 生成图片数量，默认 10
        size: 图片尺寸（宽高），默认 200
        diameter: 圆形直径，默认 200（等于size，即填满画布）
        prefix: 文件名前缀，如果为None则使用随机UUID
        use_3d: 是否使用3D立体效果，默认True
        num_threads: 线程数量，默认 10
    """
    # 创建输出目录
    os.makedirs(output_dir, exist_ok=True)
    
    # 线程锁（用于同步打印输出）
    print_lock = threading.Lock()
    
    # 使用线程池并行生成
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        # 提交所有任务
        futures = {
            executor.submit(
                _generate_single_image,
                output_dir, i, size, diameter, prefix, use_3d, print_lock
            ): i
            for i in range(num_images)
        }
        
        # 等待所有任务完成并统计
        completed = 0
        for future in as_completed(futures):
            try:
                result = future.result()
                completed += 1
                if completed % 100 == 0:
                    with print_lock:
                        print(f"进度: {completed}/{num_images} ({completed*100//num_images}%)")
            except Exception as e:
                index = futures[future]
                with print_lock:
                    print(f"任务失败 (index={index}): {e}")
    
    print(f"\n总共生成 {num_images} 张图片，保存在目录: {output_dir}")


if __name__ == "__main__":
    # 示例：生成1000张随机颜色的圆形图片（使用10个线程并行生成）
    generate_random_color_circle(
        output_dir=r"D:\Workspace\VisionSorter\samples\Basic",
        num_images=100,
        size=200,
        diameter=200,
        prefix=None,  # 使用随机文件名，也可以设置为 "circle" 使用有序文件名
        use_3d=True,  # 使用3D立体效果
        num_threads=10  # 使用10个线程并行生成
    )

