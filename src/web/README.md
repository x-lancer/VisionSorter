# 图片颜色聚类系统 - 前端

## 安装依赖

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
```

前端将在 http://localhost:3000 运行

## 构建生产版本

```bash
npm run build
```

## 使用说明

1. 在"图片目录路径"输入框中输入图片文件夹的完整路径
   - Windows: `D:\Workspace\VisionSorter\samples\Validation_MIX`
   - Linux/Mac: `/path/to/images`

2. 输入聚类数量 n

3. 点击"开始聚类"按钮

4. 等待处理完成后，查看结果：
   - 总体统计信息
   - 所有图片的列表（包含文件名和LAB值）
   - 每个类别的详细信息

## 后端API要求

确保后端服务运行在 http://localhost:8000

