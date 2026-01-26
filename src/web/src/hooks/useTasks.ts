import { useState, useCallback } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { Task, TaskType, TaskStatus, ClusterResult, DetectionResult } from '../types';
import { API_BASE_URL } from '../constants';
import { useCluster } from './useCluster';
import { useDetection } from './useDetection';
import { useTaskStore } from '../store/useTaskStore';

export const useTasks = () => {
  // 从 Store 获取状态和 Action
  const { 
    tasks, 
    savedClusterResults, 
    setTasks, 
    setSavedClusterResults,
    addTask,
    updateTask,
    updateTaskParams: updateParamsInStore,
    deleteTask: removeTaskFromStore
  } = useTaskStore();

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
          result: undefined, // 列表页不加载详情
          isSaved: true,
          dbId: item.id,
        }));
        
        // 保存聚类结果列表（仅元数据）供检测任务选择
        // 注意：Dropdown 选择时需要详情数据，所以我们需要在选中时加载，
        // 或者这里保留一些基本信息？
        // 其实 savedClusterResults 里的 clusterResult 字段之前存的是整个 payload。
        // 现在我们需要将其设为 null，并在选中时加载，或者加载时就去请求？
        // 考虑到下拉框数量可能也多，我们仅存储元数据，选中时异步加载。
        const clusterResultsList = response.data.data.map((item: any) => ({
          id: item.id,
          task_name: item.task_name || `聚类任务-${item.id}`,
          created_at: item.created_at,
          clusterResult: null, // 暂无详情
        }));
        setSavedClusterResults(clusterResultsList);
      }

      // 2. 加载检测结果
      const detectionResponse = await axios.get(`${API_BASE_URL}/api/saved-detection-results`);
      let detectionTasks: Task[] = [];
      if (detectionResponse.data.success && detectionResponse.data.data) {
        detectionTasks = detectionResponse.data.data.map((item: any) => {
          // 列表接口不再返回 payload_json，所以无法预先解析 params
          return {
            id: item.task_id || `saved_detect_${item.id}`,
            name: item.task_name || `历史检测任务-${item.id}`,
            type: 'detect' as TaskType,
            status: 'completed' as TaskStatus,
            createdAt: item.created_at,
            params: {
              imageDir: item.image_dir,
              nClusters: 0,
              // 以下字段将在打开详情时加载
              clusterResultId: undefined,
              clusterResult: undefined,
              maxScale: 1.1,
              detectionStarted: true,
              detectionResults: [],
              detectionTotal: item.total_images,
              detectionCurrentIndex: item.total_images,
            },
            result: undefined,
            isSaved: true,
            dbId: item.id,
          };
        });
      }
      
      // 合并任务列表
      setTasks((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newTasks = [...clusterTasks, ...detectionTasks].filter((t) => !existingIds.has(t.id));
        return [...prev, ...newTasks];
      });

    } catch (error) {
      console.error('加载历史结果失败:', error);
    }
  }, [setTasks, setSavedClusterResults]);

  // 加载任务详情（按需）
  const loadTaskDetail = useCallback(async (task: Task) => {
    if (!task.isSaved || !task.dbId) return;
    
    // 如果已经有数据了，跳过（简单的缓存机制）
    if (task.type === 'cluster' && task.result) return;
    if (task.type === 'detect') {
      // 新版 detect 保存时不会把海量 results 写进 payload_json（只存 recent_results/statistics），
      // 全量列表走 /api/task-images/detect/{id} 分页读取。
      // 因此这里不能只用 detectionResults 判断“是否已加载”，否则会导致反复请求 /api/result-detail。
      const hasClientResults = (task.params.detectionResults?.length ?? 0) > 0;
      const hasPreview = (task.params.recentResults?.length ?? 0) > 0;
      const hasStatistics = task.params.statistics != null;
      const hasClusterInfo = task.params.clusterResultId != null && task.params.clusterResult != null;
      if (hasClientResults || hasPreview || hasStatistics || hasClusterInfo) return;
    }

    try {
      updateTask(task.id, { isLoadingDetail: true } as any); // 假设 Task 类型有这个字段，或者我们扩展一下
      
      const response = await axios.get(`${API_BASE_URL}/api/result-detail/${task.type}/${task.dbId}`);
      if (response.data.success && response.data.data) {
        const payload = response.data.data;
        
        if (task.type === 'cluster') {
          updateTask(task.id, { 
            result: payload,
            isLoadingDetail: false 
          } as any);
        } else {
          updateTask(task.id, {
            params: {
              ...task.params,
              clusterResultId: payload.cluster_result_id,
              clusterResult: payload.cluster_result,
              maxScale: payload.max_scale || 1.1,
              detectionResults: payload.results || [],
              statistics: payload.statistics,
              recentResults: payload.recent_results,
            },
            isLoadingDetail: false
          } as any);
        }
      }
    } catch (error) {
      console.error('加载任务详情失败:', error);
      message.error('加载任务详情失败');
      updateTask(task.id, { isLoadingDetail: false } as any);
    }
  }, [updateTask]);
  
  // 加载聚类结果详情（用于检测任务选择下拉框）
  const loadClusterResultDetail = useCallback(async (dbId: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/result-detail/cluster/${dbId}`);
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
    } catch (error) {
      console.error('加载聚类详情失败:', error);
      message.error('加载聚类详情失败');
    }
    return null;
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
    addTask(newTask);
    return newTask;
  }, [tasks.length, addTask]);

  // 开始聚类
  const onStart = useCallback(async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'cluster') return;

    updateTask(taskId, { status: 'running' });

    try {
      const res = await handleCluster(task.params.imageDir, task.params.nClusters);
      if (res) {
        updateTask(taskId, { result: res, status: 'completed' });
      } else {
        updateTask(taskId, { status: 'pending' });
      }
    } catch (error: any) {
      updateTask(taskId, { 
        status: 'error', 
        errorMessage: error.message || '执行出错' 
      });
    }
  }, [tasks, handleCluster, updateTask]);

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
    updateTask(taskId, {
      status: 'running',
      params: {
        ...task.params,
        detectionStarted: true,
        detectionResults: [], // 重置检测结果
        detectionTotal: undefined,
        detectionCurrentIndex: undefined,
      },
    });
    setActiveDetectionTaskId(taskId);

    try {
      // 批处理缓冲区配置
      let resultBuffer: DetectionResult[] = [];
      let lastUpdateTime = Date.now();
      const BATCH_SIZE = 20; // 每20条更新一次 UI
      const TIME_THRESHOLD = 300; // 或每300ms更新一次 UI

      // 使用 WebSocket 实时检测
      const result = await handleDetection(
        task.params.imageDir,
        task.params.clusterResult!,
        (index, total, current) => {
          // 将结果加入缓冲区
          resultBuffer.push(current);
          
          const now = Date.now();
          // 检查是否达到刷新条件
          if (resultBuffer.length >= BATCH_SIZE || (now - lastUpdateTime > TIME_THRESHOLD)) {
            const bufferToFlush = [...resultBuffer];
            resultBuffer = []; // 清空缓冲区
            lastUpdateTime = now;

            // 批量更新 State
            setTasks((prev) => 
              prev.map(t => {
                if (t.id !== taskId) return t;
                return {
                  ...t,
                  params: {
                    ...t.params,
                    detectionResults: [...(t.params.detectionResults || []), ...bufferToFlush],
                    detectionTotal: total,
                    detectionCurrentIndex: index + 1,
                  }
                };
              })
            );
          }
        },
        task.params.maxScale || 1.1
      );

      // 检测结束后处理
      if (result) {
        const { results: finalResults, reason } = result;
        setTasks((prev) => 
          prev.map(t => {
            if (t.id !== taskId) return t;
            return {
              ...t,
              // 如果是正常完成，则更新状态为 completed
              // 如果是 cancelled (暂停或取消)，则保留当前状态（paused 或 pending）
              status: reason === 'completed' ? 'completed' : t.status,
              params: {
                ...t.params,
                detectionResults: finalResults,
                detectionTotal: finalResults.length,
                detectionCurrentIndex: finalResults.length,
              }
            };
          })
        );
      } else {
         // 返回 null 表示启动失败（如参数校验不通过），重置为 pending
         updateTask(taskId, { status: 'pending' });
      }

      setActiveDetectionTaskId(null);
    } catch (error: any) {
      // 检测出错或被取消
      updateTask(taskId, { 
        status: 'error', 
        errorMessage: error.message || '检测过程中发生错误' 
      });
      setActiveDetectionTaskId(null);
    }
  }, [tasks, handleDetection, updateTask, setTasks]);

  // 取消检测
  const onCancelDetection = useCallback((taskId: string) => {
    cancelDetection();
    updateTask(taskId, { status: 'pending' });
    setActiveDetectionTaskId(null);
  }, [cancelDetection, updateTask]);

  // 暂停检测
  const onPauseDetection = useCallback((taskId: string) => {
    if (activeDetectionTaskId === taskId) {
      cancelDetection();
      updateTask(taskId, { status: 'paused' });
      setActiveDetectionTaskId(null);
    }
  }, [activeDetectionTaskId, cancelDetection, updateTask]);

  // 继续检测
  const onResumeDetection = useCallback((taskId: string) => {
    onStartDetection(taskId);
  }, [onStartDetection]);

  // 更新任务参数
  const updateTaskParams = useCallback((taskId: string, params: Partial<Task['params']>) => {
    updateParamsInStore(taskId, params);
  }, [updateParamsInStore]);

  // 更新任务名称
  const updateTaskName = useCallback((taskId: string, newName: string) => {
    updateTask(taskId, { name: newName });
  }, [updateTask]);

  // 保存聚类结果
  const handleSaveResult = useCallback(async (task: Task) => {
    const saveResponse = await saveCurrentResult(task.name, task.id);
    if (saveResponse && saveResponse.success) {
      // 1. 标记任务为已保存，记录 dbId
      // 2. 释放内存：清空 result 中的 images 列表，强迫 UI 走 Server Mode
      setTasks((prev) => 
        prev.map(t => {
          if (t.id !== task.id) return t;
          
          // 创建一个瘦身的 result 对象
          const slimResult = t.result ? {
            ...t.result,
            images: [], // 清空图片列表
            clusters: t.result.clusters, // 保留 cluster 统计信息（注意：clusters.{id}.images 暂未清空，如果很大也建议清空）
          } : undefined;

          // 如果 clusters.{id}.image_paths 也包含全量数据，也应该清理
          if (slimResult && slimResult.clusters) {
             Object.keys(slimResult.clusters).forEach(cid => {
               slimResult.clusters[cid].image_paths = []; // 清理
             });
          }

          return {
            ...t,
            isSaved: true,
            dbId: saveResponse.id,
            result: slimResult
          };
        })
      );
      
      // 重新加载聚类结果列表
      try {
        const response = await axios.get(`${API_BASE_URL}/api/saved-cluster-results`);
        if (response.data.success && response.data.data) {
          const clusterResultsList = response.data.data.map((item: any) => ({
            id: item.id,
            task_name: item.task_name || `聚类任务-${item.id}`,
            created_at: item.created_at,
            clusterResult: null, // 暂无详情
          }));
          setSavedClusterResults(clusterResultsList);
        }
      } catch (error) {
        console.error('刷新聚类结果列表失败:', error);
      }
    }
  }, [saveCurrentResult, setTasks, setSavedClusterResults]);

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
        cluster_result: task.params.clusterResult,
        cluster_result_id: task.params.clusterResultId,
      });
      
      if (response.data && response.data.success) {
        message.success('检测结果已保存');
        
        // 保存成功后，释放内存并切换到 Server Mode
        setTasks((prev) => 
          prev.map(t => {
            if (t.id !== task.id) return t;
            return {
              ...t,
              isSaved: true,
              dbId: response.data.id,
              params: {
                ...t.params,
                detectionResults: [], // 清空检测结果列表
                recentResults: t.params.detectionResults?.slice(-10), // 保留预览
                // 保留 statistics 如果有的话，或者后端返回？
                // 刚才后端的 save 接口没返回 payload。
                // 我们可以简单保留前端计算好的 statistics，或者不保留，DetectionStatistics 会根据空数据渲染空。
                // 更好的做法是：保留前端已有的 statistics。
                // 但 DetectionStatistics 的逻辑是：如果有 statistics prop 就用，没有就用 detectionResults 计算。
                // 所以我们应该把当前的统计存入 params.statistics
              }
            };
          })
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
  }, [setTasks]);

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

    removeTaskFromStore(taskId);
  }, [tasks, removeTaskFromStore]);

  return {
    tasks,
    setTasks, // 依然导出 setTasks 以兼容旧代码，但底层是 store
    savedClusterResults,
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
    loadTaskDetail,
    loadClusterResultDetail,
  };
};
