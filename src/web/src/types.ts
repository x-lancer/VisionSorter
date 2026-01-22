export interface ImageInfo {
  path: string;
  filename: string;
  lab: { L: number; a: number; b: number };
  cluster_id: number;
}

export interface ClusterInfo {
  cluster_id: number;
  count: number;
  lab_mean: number[];
  lab_std: number[];
  de2000_mean: number;
  de2000_max: number;
  de2000_std: number;
  de2000_intra_mean: number;
  de2000_intra_max: number;
  image_paths: string[];
}

export interface ClusterResult {
  success: boolean;
  total_images: number;
  n_clusters: number;
  inter_cluster_stats: {
    mean: number;
    min: number;
    max: number;
    std: number;
  };
  images: ImageInfo[];
  clusters: Record<string, ClusterInfo>;
}

// 任务相关类型
export type TaskType = 'cluster' | 'detect';
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error';

export interface DetectionResult {
  filename: string;
  path: string;
  lab: {
    L: number;
    a: number;
    b: number;
  } | null;
  matched_cluster_id: number | null;
  distance: number | null;
  status: string;
  elapsed_time?: number; // 检测耗时（毫秒）
}

export interface Task {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: string;
  params: {
    imageDir: string;
    nClusters: number;
    clusterResultId?: number;  // 检测任务引用的聚类结果ID（数据库ID）
    clusterResult?: ClusterResult;  // 检测任务引用的聚类结果数据
    maxScale?: number; // 允许新样本距离比类内最大距离多出的比例，默认1.1
    detectionStarted?: boolean;  // 检测任务是否已开始检测
    detectionResults?: DetectionResult[];  // 检测结果列表
    detectionTotal?: number; // 待检测总数
    detectionCurrentIndex?: number; // 当前进度序号（1-based）
  };
  result?: ClusterResult;
  errorMessage?: string;
  isSaved?: boolean;  // 是否已保存到数据库
  dbId?: number;      // 数据库记录ID
}

// Tab 相关类型
export type TabType = 'taskPanel' | 'systemParams' | 'task';

export interface TabItem {
  key: string;
  type: TabType;
  label: string;
  closable: boolean;
  taskId?: string; // 仅 task 类型有
  initialTask?: Task; // 用于解决创建任务时的状态同步问题
  isPinned?: boolean; // 是否固定
}

// 固定的系统 Tab key
export const TASK_PANEL_KEY = '__task_panel__';
export const SYSTEM_PARAMS_KEY = '__system_params__';
