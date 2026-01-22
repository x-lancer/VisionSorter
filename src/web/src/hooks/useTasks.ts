import { useState, useCallback } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { Task, TaskType, TaskStatus, ClusterResult, DetectionResult } from '../types';
import { API_BASE_URL } from '../constants';
import { useCluster } from './useCluster';
import { useDetection } from './useDetection';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [savedClusterResults, setSavedClusterResults] = useState<Array<{
    id: number;
    task_name: string;
    created_at: string;
    clusterResult: ClusterResult;
  }>>([]);
  const [activeResultTab, setActiveResultTab] = useState<string>('statistics');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [activeDetectionTaskId, setActiveDetectionTaskId] = useState<string | null>(null);
  const [detectionViewKey, setDetectionViewKey] = useState<'overview' | 'list' | 'statistics'>('overview');
  const [savingDetectionTaskId, setSavingDetectionTaskId] = useState<string | null>(null);
  
  // 检测列表搜索和筛选状态
  const [searchText, setSearchText] = useState<string>('');
  const [filterClusterId, setFilterClusterId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { loading, handleCluster, saveCurrentResult, saving } = useCluster();
  const { loading: detectionLoading, handleDetection, cancelDetection } = useDetection();

  // 加载已保存的聚类结果
  const loadSavedResults = useCallback(async () => {
    try {
      let clusterTasks: Task[] = [];
      const response = await axios.get(`${API_BASE_URL}/api/saved-cluster-results`);
      if (response.data.success && response.data.data) {
        clusterTasks = response.data.data.map((item: any) => ({
          id: item.task_id || `saved_${item.id}`,
          name: item.task_name || `历史任务-${item.id}`,
          type: 'cluster' as TaskType,
          status: 'completed' as TaskStatus,
          createdAt: item.created_at,
          params: {
            imageDir: item.image_dir,
            nClusters: item.n_clusters,
          },
          result: item.payload_json ? JSON.parse(item.payload_json) : undefined,
          isSaved: true,
          dbId: item.id,
        }));
        
        // 保存聚类结果列表供检测任务选择
        const clusterResultsList = response.data.data.map((item: any) => ({
          id: item.id,
          task_name: item.task_name || `聚类任务-${item.id}`,
          created_at: item.created_at,
          clusterResult: item.payload_json ? JSON.parse(item.payload_json) : null,
        })).filter((item: any) => item.clusterResult !== null);
        setSavedClusterResults(clusterResultsList);
      }

      // 2. 加载检测结果
      const detectionResponse = await axios.get(`${API_BASE_URL}/api/saved-detection-results`);
      let detectionTasks: Task[] = [];
      if (detectionResponse.data.success && detectionResponse.data.data) {
        detectionTasks = detectionResponse.data.data.map((item: any) => {
          const payload = item.payload_json ? JSON.parse(item.payload_json) : {};
          return {
            id: item.task_id || `saved_detect_${item.id}`,
            name: item.task_name || `历史检测任务-${item.id}`,
            type: 'detect' as TaskType,
            status: 'completed' as TaskStatus,
            createdAt: item.created_at,
            params: {
              imageDir: item.image_dir,
              nClusters: 0,
              clusterResultId: undefined,
              clusterResult: undefined,
              maxScale: payload.max_scale || 1.1,
              detectionStarted: true,
              detectionResults: payload.results || [],
              detectionTotal: item.total_images,
              detectionCurrentIndex: item.total_images,
            },
            result: undefined,
            isSaved: true,
            dbId: item.id,
          };
        });
      }
      
      // 合并任务列表（展示已保存的聚类和检测任务）
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTasks = [...clusterTasks, ...detectionTasks].filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTasks];
      });

    } catch (error) {
      console.error('加载历史结果失败:', error);
    }
  }, []);

  // 创建新任务
  const createTask = useCallback((type: TaskType) => {
    const id = `${Date.now()}`;
    const name = type === 'cluster' ? `聚类任务-${tasks.length + 1}` : `检测任务-${tasks.length + 1}`;
    const createdAt = new Date().toLocaleString();
    const newTask: Task = {
      id,
      name,
      type,
      status: 'pending',
      createdAt,
      params: type === 'cluster' 
        ? { imageDir: '', nClusters: 5 }
        : { imageDir: '', nClusters: 5, maxScale: 1.1 }, // 检测任务的params会在选择聚类结果后更新
    };
    setTasks((prev) => [...prev, newTask]);
    return newTask;
  }, [tasks.length]);

  // 开始聚类
  const onStart = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'cluster') return;

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status: 'running' as TaskStatus } : t,
      ),
    );

    try {
      const res = await handleCluster(task.params.imageDir, task.params.nClusters);
      if (res) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, result: res, status: 'completed' as TaskStatus }
              : t,
          ),
        );
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, status: 'pending' as TaskStatus }
              : t,
          ),
        );
      }
    } catch (error: any) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: 'error' as TaskStatus, errorMessage: error.message || '执行出错' }
            : t,
        ),
      );
    }
  }, [tasks, handleCluster]);

  // 开始检测
  const onStartDetection = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'detect') return;
    
    // 验证必需参数
    if (!task.params.clusterResultId || !task.params.clusterResult || !task.params.imageDir.trim()) {
      message.error('请先选择聚类结果和填写待检测图片目录');
      return;
    }

    // 标记检测已开始
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'running' as TaskStatus,
              params: {
                ...t.params,
                detectionStarted: true,
                detectionResults: [], // 重置检测结果
                detectionTotal: undefined,
                detectionCurrentIndex: undefined,
              },
            }
          : t,
      ),
    );
    setActiveDetectionTaskId(taskId);

    try {
      // 使用 WebSocket 实时检测
      await handleDetection(
        task.params.imageDir,
        task.params.clusterResult!,
        (index, total, current) => {
          // 实时更新任务状态和结果
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    params: {
                      ...t.params,
                      detectionResults: [...(t.params.detectionResults || []), current as any],
                      detectionTotal: total,
                      detectionCurrentIndex: index + 1,
                    },
                  }
                : t,
            ),
          );
        },
        task.params.maxScale || 1.1
      );

      // 检测完成（结果已在 onProgress 中更新）
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'completed' as TaskStatus,
              }
            : t,
        ),
      );
      setActiveDetectionTaskId(null);
    } catch (error: any) {
      // 检测出错或被取消
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'error' as TaskStatus,
                errorMessage: error.message || '检测过程中发生错误',
              }
            : t,
        ),
      );
      setActiveDetectionTaskId(null);
    }
  }, [tasks, handleDetection]);

  // 取消检测
  const onCancelDetection = useCallback((taskId: string) => {
    cancelDetection();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: 'pending' as TaskStatus,
            }
          : t,
      ),
    );
    setActiveDetectionTaskId(null);
  }, [cancelDetection]);

  // 暂停检测
  const onPauseDetection = useCallback((taskId: string) => {
    if (activeDetectionTaskId === taskId) {
      cancelDetection();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: 'paused' as TaskStatus,
              }
            : t,
        ),
      );
      setActiveDetectionTaskId(null);
    }
  }, [activeDetectionTaskId, cancelDetection]);

  // 继续检测
  const onResumeDetection = useCallback((taskId: string) => {
    onStartDetection(taskId);
  }, [onStartDetection]);

  // 更新任务参数
  const updateTaskParams = useCallback((taskId: string, params: Partial<Task['params']>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, params: { ...t.params, ...params } } : t
      )
    );
  }, []);

  // 更新任务名称
  const updateTaskName = useCallback((taskId: string, newName: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, name: newName } : task))
    );
  }, []);

  // 保存聚类结果
  const handleSaveResult = useCallback(async (task: Task) => {
    await saveCurrentResult(task.name, task.id);
    // 标记任务为已保存
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isSaved: true } : t))
    );
    // 重新加载聚类结果列表，以便检测任务可以选择最新保存的结果
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-cluster-results`);
      if (response.data.success && response.data.data) {
        const clusterResultsList = response.data.data.map((item: any) => ({
          id: item.id,
          task_name: item.task_name || `聚类任务-${item.id}`,
          created_at: item.created_at,
          clusterResult: item.payload_json ? JSON.parse(item.payload_json) : null,
        })).filter((item: any) => item.clusterResult !== null);
        setSavedClusterResults(clusterResultsList);
      }
    } catch (error) {
      console.error('刷新聚类结果列表失败:', error);
    }
  }, [saveCurrentResult]);

  // 保存检测结果
  const handleSaveDetectionResult = useCallback(async (task: Task) => {
    if (!task.params.detectionResults || task.params.detectionResults.length === 0) {
      message.warning('暂无可保存的检测结果');
      return;
    }
    const total =
      task.params.detectionTotal && task.params.detectionTotal > 0
        ? task.params.detectionTotal
        : task.params.detectionResults.length;
    const classified = task.params.detectionResults.filter(
      (r) => r.matched_cluster_id !== null,
    ).length;

    try {
      setSavingDetectionTaskId(task.id);
      const response = await axios.post(`${API_BASE_URL}/api/save-detection-result`, {
        image_dir: task.params.imageDir,
        total,
        classified,
        results: task.params.detectionResults,
        max_scale: task.params.maxScale || 1.1,
        task_name: task.name,
        task_id: task.id,
      });
      if (response.data && response.data.success) {
        message.success('检测结果已保存');
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  isSaved: true,
                }
              : t,
          ),
        );
      } else {
        message.error(response.data?.message || '保存检测结果失败');
      }
    } catch (error) {
      console.error('保存检测结果失败:', error);
      message.error('保存检测结果失败，请检查服务状态');
    } finally {
      setSavingDetectionTaskId(null);
    }
  }, []);

  // 删除任务
  const handleDeleteTask = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // 如果是已保存的任务，调用后端接口删除
    if (task.isSaved && task.dbId) {
      try {
        const response = await axios.delete(`${API_BASE_URL}/api/delete-result/${task.dbId}`, {
          params: { type: task.type },
        });
        if (response.data.success) {
          message.success('任务已从数据库删除');
        } else {
          message.error(response.data.message || '删除失败');
          return; // 删除失败则不移除前端任务
        }
      } catch (error) {
        console.error('删除任务失败:', error);
        message.error('删除任务失败');
        return;
      }
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }, [tasks]);

  // 处理聚类选择（从统计页面）
  const handleClusterSelectFromStatistics = useCallback((clusterId: number) => {
    setActiveResultTab('clusters');
    setActiveClusterId(String(clusterId));
  }, []);

  return {
    tasks,
    setTasks,
    savedClusterResults,
    activeResultTab,
    setActiveResultTab,
    activeClusterId,
    setActiveClusterId,
    activeDetectionTaskId,
    detectionViewKey,
    setDetectionViewKey,
    savingDetectionTaskId,
    searchText,
    setSearchText,
    filterClusterId,
    setFilterClusterId,
    filterStatus,
    setFilterStatus,
    loading,
    detectionLoading,
    saving,
    loadSavedResults,
    createTask,
    onStart,
    onStartDetection,
    onCancelDetection,
    onPauseDetection,
    onResumeDetection,
    updateTaskParams,
    updateTaskName,
    handleSaveResult,
    handleSaveDetectionResult,
    handleDeleteTask,
    handleClusterSelectFromStatistics,
  };
};
