import ctypes
import numpy as np
import cv2

# =========================================================================
# 模拟：这是相机厂商提供的底层 SDK (C语言风格)
# 实际开发中，这些通常来自 `MvCameraControl.dll` (海康) 或 `pylon` (Basler)
# =========================================================================

# 假设 SDK 传给我们的原始数据结构
class MvFrameInfo(ctypes.Structure):
    _fields_ = [
        ("width", ctypes.c_int),
        ("height", ctypes.c_int),
        ("pData", ctypes.POINTER(ctypes.c_ubyte)), # 指向图像数据的指针
        ("dataSize", ctypes.c_int)
    ]

# =========================================================================
# Python 端的实现逻辑
# =========================================================================

def camera_callback_function(pFrameInfo, pUser):
    """
    这是我们需要注册给相机的回调函数。
    每当相机拍到一张照片，SDK 会自动调用这个函数，把数据指针传给我们。
    """
    print(f"[SDK] 收到回调! 图像大小: {pFrameInfo.contents.width} x {pFrameInfo.contents.height}")

    # --- 核心步骤：零拷贝数据转换 (Zero-Copy) ---
    
    # 1. 获取 C 指针: pFrameInfo.contents.pData
    c_pointer = pFrameInfo.contents.pData
    
    # 2. 告诉 Numpy 这个指针有多长 (Height * Width * Channels)
    # 假设是 RGB 彩色图 (3通道)
    height = pFrameInfo.contents.height
    width = pFrameInfo.contents.width
    data_size = height * width * 3 
    
    # 3. 魔法时刻: 将 C 指针直接映射为 Numpy 数组
    # ctypes.cast 确保类型正确，np.ctypeslib.as_array 创建视图
    # 注意：这里没有发生数据复制，Python 直接读取了 C 的内存
    img_array = np.ctypeslib.as_array(c_pointer, shape=(height, width, 3))
    
    # 这样你就得到了一个标准的 OpenCV 图片！
    print(f"[Python] 转换成功: shape={img_array.shape}, dtype={img_array.dtype}")
    
    # 接下来就可以直接送入之前的算法了...
    # classifier.process_image(img_array)


# =========================================================================
# 模拟运行
# =========================================================================
if __name__ == "__main__":
    # 1. 造一个假数据 (模拟相机内存中的 raw data)
    height, width = 1000, 1000
    fake_image_data = np.zeros((height, width, 3), dtype=np.uint8)
    # 弄点颜色
    fake_image_data[:, :] = [255, 0, 0] # Blue
    
    # 获取它的内存地址 (模拟 SDK 内部操作)
    c_data_pointer = fake_image_data.ctypes.data_as(ctypes.POINTER(ctypes.c_ubyte))
    
    # 2. 构造 SDK 信息结构体
    frame_info = MvFrameInfo()
    frame_info.width = width
    frame_info.height = height
    frame_info.pData = c_data_pointer
    
    # 3. 模拟相机触发回调
    print("--- 模拟硬件触发 ---")
    camera_callback_function(ctypes.pointer(frame_info), None)
