import cv2
import numpy as np
import os

# 配置
IMAGE_PATH = 'uploaded_image_1768302927308.png'
DEBUG_OUTPUT = 'debug_mask.jpg'

def analyze_bead_color(image_path):
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    # 1. 读取图片
    img = cv2.imread(image_path)
    if img is None:
        print("Error: Failed to load image.")
        return

    print(f"Loaded image shape: {img.shape}")

    # 2. 预处理 (去噪)
    # 使用高斯模糊减少噪声
    blurred = cv2.GaussianBlur(img, (5, 5), 0)

    # 3. 转换到 HSV 空间
    hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
    
    # 4. 生成掩码 (Masking)
    # 我们需要扣除背景 (通常是白色) 和高光 (通常是极亮且饱和度低)
    
    # 提取 S (Saturation) 和 V (Value) 通道
    h, s, v = cv2.split(hsv)

    # 背景识别: 白色背景通常 V 很高, S 很低
    # 高光识别: 反光区域 V 极高 (接近255), S 极低
    # 珠子区域: 通常 S 较高 (有颜色), 或者 V 适中
    
    # 策略: 寻找 "有颜色" 的区域 (S > 30) 且 "不是过亮" 的区域 (V < 250)
    # 注意: 这个阈值可能需要调整
    
    # 饱和度阈值: 过滤掉灰/白/黑背景
    s_mask = cv2.threshold(s, 30, 255, cv2.THRESH_BINARY)[1]
    
    # 亮度阈值: 过滤掉极亮的反光点
    v_mask = cv2.threshold(v, 245, 255, cv2.THRESH_BINARY_INV)[1]
    
    # 组合掩码
    final_mask = cv2.bitwise_and(s_mask, v_mask)
    
    # 形态学操作: 开运算去除噪点, 闭运算填充孔洞
    kernel = np.ones((5,5), np.uint8)
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_OPEN, kernel)
    final_mask = cv2.morphologyEx(final_mask, cv2.MORPH_CLOSE, kernel)

    # 5. 计算有效区域的统计特征
    # 只统计掩码为 255 (白色) 的区域
    mean_color_hsv = cv2.mean(hsv, mask=final_mask)
    mean_h = mean_color_hsv[0]
    mean_s = mean_color_hsv[1]
    mean_v = mean_color_hsv[2]

    # 为了显示方便，生成一个调试图：将掩码应用到原图上
    debug_img = cv2.bitwise_and(img, img, mask=final_mask)
    cv2.imwrite(DEBUG_OUTPUT, debug_img)
    print(f"Debug image saved to: {DEBUG_OUTPUT}")

    # 6. 结果输出与简单分类逻辑
    print("-" * 30)
    print(f"Analysis Result:")
    print(f"Mean Hue (0-179): {mean_h:.2f}")
    print(f"Mean Saturation (0-255): {mean_s:.2f}")
    print(f"Mean Value (0-255): {mean_v:.2f}")

    # 简单的分类判断 (示例)
    # OpenCV HSV ranges: H: 0-179, S: 0-255, V: 0-255
    # Green is roughly around 60 (35-85)
    category = "Unknown"
    
    if 35 <= mean_h <= 85:
        category = "Green"
    elif 100 <= mean_h <= 130:
        category = "Blue"
    elif 0 <= mean_h <= 10 or 160 <= mean_h <= 179:
        category = "Red"
    elif 20 <= mean_h <= 34:
        category = "Yellow"
    
    print(f"Estimated Category: {category} (Base on H={mean_h:.2f})")
    print("-" * 30)

if __name__ == "__main__":
    analyze_bead_color(IMAGE_PATH)
