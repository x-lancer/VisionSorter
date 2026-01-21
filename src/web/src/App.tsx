import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Tabs, Card, Dropdown, ConfigProvider, theme, Input, Select, Button, Space, Table, Empty, Tag, Progress, message } from 'antd';
import axios from 'axios';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  MoonOutlined,
  SunOutlined,
  LeftOutlined,
  RightOutlined,
  UnorderedListOutlined,
  SettingOutlined,
  PushpinOutlined,
  PushpinFilled,
} from '@ant-design/icons';
import ParameterConfig from './components/ParameterConfig';
import LoadingSpinner from './components/LoadingSpinner';
import ResultStatistics from './components/ResultStatistics';
import ImageList from './components/ImageList';
import ClusterTabs from './components/ClusterTabs';
import ResultPlaceholder from './components/ResultPlaceholder';
import TaskList from './components/TaskList';
import { useCluster } from './hooks/useCluster';
import { useDetection } from './hooks/useDetection';
import { API_BASE_URL } from './constants';
import type { ClusterResult } from './types';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

// 将 Lab 转为近似 sRGB 颜色，用于前端颜色小圆展示
const labToRgbColor = (L: number, a: number, b: number): string => {
  // 简化版 CIE Lab -> XYZ -> sRGB，仅用于可视化
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const pivot = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };

  const X = 95.047 * pivot(x);
  const Y = 100.0 * pivot(y);
  const Z = 108.883 * pivot(z);

  let r = X * 0.032406 + Y * -0.015372 + Z * -0.004986;
  let g = X * -0.009689 + Y * 0.018758 + Z * 0.000415;
  let bl = X * 0.000557 + Y * -0.00204 + Z * 0.01057;

  const convert = (c: number) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  r = convert(r);
  g = convert(g);
  bl = convert(bl);

  const to255 = (c: number) => Math.round(c * 255);

  return `rgb(${to255(r)}, ${to255(g)}, ${to255(bl)})`;
};

// 全局样式
const globalStyle = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .ant-card {
    border-radius: 0 !important;
  }
  .ant-card .ant-card-head {
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }
  .ant-card .ant-card-body {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
  }
  .root-tabs .ant-tabs-content-holder {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .root-tabs .ant-tabs-content {
    height: 100%;
  }
  .root-tabs .ant-tabs-tabpane {
    height: 100%;
    overflow: auto;
  }
  .ant-tabs-card > .ant-tabs-nav {
    margin-bottom: 0;
  }
  .ant-tabs-card > .ant-tabs-content-holder {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
  .ant-tabs-card.ant-tabs-top > .ant-tabs-content-holder {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
`;

type TaskType = 'cluster' | 'detect';
type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error';

interface DetectionResult {
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
}

interface Task {
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

// Tab 类型定义
type TabType = 'taskPanel' | 'systemParams' | 'task';

interface TabItem {
  key: string;
  type: TabType;
  label: string;
  closable: boolean;
  taskId?: string; // 仅 task 类型有
  isPinned?: boolean; // 是否固定
}

// 固定的系统 Tab key
const TASK_PANEL_KEY = '__task_panel__';
const SYSTEM_PARAMS_KEY = '__system_params__';

// 可拖拽的 Tab 项组件
interface DraggableTabPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-node-key': string;
}

const DraggableTabNode: React.FC<DraggableTabPaneProps> = ({ 'data-node-key': key, ...props }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: key,
  });

  const style: React.CSSProperties = {
    ...props.style,
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'grab',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} {...props} />
  );
};

const App: React.FC = () => {
  // Tab 状态
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  
  // 任务状态
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeResultTab, setActiveResultTab] = useState<string>('statistics');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  
  // 已保存的聚类结果列表（用于检测任务选择）
  const [savedClusterResults, setSavedClusterResults] = useState<Array<{
    id: number;
    task_name: string;
    created_at: string;
    clusterResult: ClusterResult;
  }>>([]);
  
  // 其他状态
  const { loading, handleCluster, saveCurrentResult, saving } = useCluster();
  const { loading: detectionLoading, results: detectionResults, currentImageIndex, handleDetection, cancelDetection } = useDetection();
  const [isDark, setIsDark] = useState<boolean>(false);
  const [siderCollapsed, setSiderCollapsed] = useState<boolean>(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');
  const [savingDetectionTaskId, setSavingDetectionTaskId] = useState<string | null>(null);
  const [activeDetectionTaskId, setActiveDetectionTaskId] = useState<string | null>(null);
  const [detectionViewKey, setDetectionViewKey] = useState<'overview' | 'list'>('overview');

  // 拖拽排序相关
  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 10 } });
  const sensors = useSensors(sensor);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      setTabs((prev) => {
        const activeIndex = prev.findIndex((tab) => tab.key === active.id);
        const overIndex = prev.findIndex((tab) => tab.key === over.id);
        return arrayMove(prev, activeIndex, overIndex);
      });
    }
  };

  // 加载已保存的聚类结果
  const loadSavedResults = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/saved-cluster-results`);
      if (response.data.success && response.data.data) {
        const savedTasks: Task[] = response.data.data.map((item: any) => ({
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
        
        // 合并已保存的任务（去重，以 task_id 为准）
        setTasks((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          const newSavedTasks = savedTasks.filter((t: Task) => !existingIds.has(t.id));
          return [...prev, ...newSavedTasks];
        });
      }
    } catch (error) {
      console.error('加载历史结果失败:', error);
    }
  }, []);

  // 组件挂载时加载已保存的结果，并默认打开固定的「系统参数」和「任务面板」Tab
  useEffect(() => {
    loadSavedResults();
    // 默认同时打开「系统参数」和「任务面板」，并设为固定状态
    setTabs([
      { key: SYSTEM_PARAMS_KEY, type: 'systemParams', label: '系统参数', closable: true, isPinned: true },
      { key: TASK_PANEL_KEY, type: 'taskPanel', label: '任务面板', closable: true, isPinned: true },
    ]);
    setActiveTabKey(TASK_PANEL_KEY);
  }, [loadSavedResults]);

  // 打开或切换到指定 Tab
  const openOrSwitchTab = (key: string, type: TabType, label: string, closable: boolean, taskId?: string) => {
    const existingTab = tabs.find((tab) => tab.key === key);
    if (existingTab) {
      setActiveTabKey(key);
    } else {
      setTabs((prev) => [...prev, { key, type, label, closable, taskId }]);
      setActiveTabKey(key);
    }
  };

  // 打开任务面板
  const openTaskPanel = () => {
    openOrSwitchTab(TASK_PANEL_KEY, 'taskPanel', '任务面板', true);
  };

  // 打开系统参数
  const openSystemParams = () => {
    openOrSwitchTab(SYSTEM_PARAMS_KEY, 'systemParams', '系统参数', true);
  };

  // 打开任务详情
  const openTaskDetail = (task: Task) => {
    const tabKey = `task_${task.id}`;
    openOrSwitchTab(tabKey, 'task', task.name, true, task.id);
  };

  // 创建新任务并打开
  const createTask = (type: TaskType) => {
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
        : { imageDir: '', nClusters: 5 }, // 检测任务的params会在选择聚类结果后更新
    };
    setTasks((prev) => [...prev, newTask]);
    openTaskDetail(newTask);
  };

  // 关闭 Tab
  const closeTab = (targetKey: string) => {
    const targetIndex = tabs.findIndex((tab) => tab.key === targetKey);
    const newTabs = tabs.filter((tab) => tab.key !== targetKey);
    setTabs(newTabs);
    
    // 如果关闭的是当前激活的 Tab，需要切换到其他 Tab
    if (activeTabKey === targetKey && newTabs.length > 0) {
      // 优先切换到右边的 Tab，否则切换到左边的
      const newActiveIndex = targetIndex >= newTabs.length ? newTabs.length - 1 : targetIndex;
      setActiveTabKey(newTabs[newActiveIndex].key);
    } else if (newTabs.length === 0) {
      setActiveTabKey(null);
    }
  };

  // 固定/取消固定 Tab
  const togglePinTab = (targetKey: string) => {
    setTabs((prev) => {
      const updated = prev.map((tab) =>
        tab.key === targetKey ? { ...tab, isPinned: !tab.isPinned } : tab
      );
      // 固定的 Tab 排到前面
      return updated.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
    });
  };

  // 处理 Tab 编辑（关闭）
  const handleTabEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) => {
    if (action === 'remove' && typeof targetKey === 'string') {
      closeTab(targetKey);
    }
    // "add" 动作为自定义 addIcon 的下拉菜单处理，这里不直接处理
  };

  // 开始聚类
  const onStart = async (taskId: string) => {
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
  };

  // 开始检测
  const onStartDetection = async (taskId: string) => {
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
        }
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
  };

  // 取消检测
  const onCancelDetection = (taskId: string) => {
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
  };

  // 暂停检测：本质上与取消类似，但状态为 paused，保留当前结果
  const onPauseDetection = (taskId: string) => {
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
  };

  // 继续检测：从头重新开始一次检测
  const onResumeDetection = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.type !== 'detect') return;
    onStartDetection(taskId);
  };

  const handleClusterSelectFromStatistics = (clusterId: number) => {
    setActiveResultTab('clusters');
    setActiveClusterId(String(clusterId));
  };

  // 任务重命名相关
  const handleTabDoubleClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setEditingTaskId(taskId);
      setEditingTaskName(task.name);
    }
  };

  const handleTaskNameChange = (taskId: string, newName: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, name: newName } : task))
    );
    // 同步更新 Tab 名称
    setTabs((prev) =>
      prev.map((tab) => (tab.taskId === taskId ? { ...tab, label: newName } : tab))
    );
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleTaskNameBlur = (taskId: string) => {
    if (editingTaskName.trim()) {
      handleTaskNameChange(taskId, editingTaskName.trim());
    } else {
      setEditingTaskId(null);
      setEditingTaskName('');
    }
  };

  const handleTaskNameKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter') {
      if (editingTaskName.trim()) {
        handleTaskNameChange(taskId, editingTaskName.trim());
      }
    } else if (e.key === 'Escape') {
      setEditingTaskId(null);
      setEditingTaskName('');
    }
  };

  // 保存聚类结果并标记任务为已保存
  const handleSaveResult = async (task: Task) => {
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
  };

  // 保存检测结果
  const handleSaveDetectionResult = async (task: Task) => {
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
  };

  // 删除任务
  const handleDeleteTask = (taskId: string) => {
    // 关闭对应的 Tab
    const tabKey = `task_${taskId}`;
    closeTab(tabKey);
    // 删除任务
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // Tab 右键菜单
  const getTabContextMenuItems = (tabKey: string) => {
    const tab = tabs.find((t) => t.key === tabKey);
    if (!tab) return [];

    return [
      {
        key: 'pin',
        label: tab.isPinned ? '取消固定' : '固定',
        onClick: () => togglePinTab(tabKey),
      },
      { type: 'divider' as const },
      ...(tab.type === 'task' ? [{
        key: 'rename',
        label: '重命名',
        onClick: () => {
          if (tab.taskId) {
            handleTabDoubleClick(tab.taskId);
          }
        },
      },
      { type: 'divider' as const }] : []),
      {
        key: 'close',
        label: '关闭当前标签页',
        onClick: () => closeTab(tabKey),
        disabled: tab.isPinned,
      },
      {
        key: 'closeOthers',
        label: '关闭其他标签页',
        onClick: () => {
          // 保留当前 Tab 和所有固定的 Tab
          setTabs(tabs.filter((t) => t.key === tabKey || t.isPinned));
          setActiveTabKey(tabKey);
        },
        disabled: tabs.length <= 1,
      },
      {
        key: 'closeAll',
        label: '关闭所有标签页',
        onClick: () => {
          // 只保留固定的 Tab
          const pinnedTabs = tabs.filter((t) => t.isPinned);
          setTabs(pinnedTabs);
          setActiveTabKey(pinnedTabs.length > 0 ? pinnedTabs[0].key : null);
        },
        disabled: tabs.every((t) => t.isPinned),
      },
    ];
  };

  // 渲染 Tab 内容
  const renderTabContent = (tab: TabItem) => {
    switch (tab.type) {
      case 'taskPanel':
        return (
          <Card
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'auto', padding: 24 } }}
          >
            <TaskList
              tasks={tasks}
              onViewTask={(taskId) => {
                const task = tasks.find((t) => t.id === taskId);
                if (task) openTaskDetail(task);
              }}
              onDeleteTask={handleDeleteTask}
            />
          </Card>
        );

      case 'systemParams':
        return (
          <Card
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text type="secondary">系统参数配置功能建设中...</Text>
          </Card>
        );

      case 'task': {
        const task = tasks.find((t) => t.id === tab.taskId);
        if (!task) {
          return (
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text type="secondary">任务不存在</Text>
            </div>
          );
        }

        if (task.type === 'cluster') {
          return (
            <div style={{ width: '100%', height: '100%', display: 'flex' }}>
              <div style={{ flex: '0 0 320px', width: 320, display: 'flex', flexDirection: 'column' }}>
                <ParameterConfig
                  imageDir={task.params.imageDir}
                  nClusters={task.params.nClusters}
                  loading={loading && activeTabKey === `task_${task.id}`}
                  onImageDirChange={(value) => {
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === task.id ? { ...t, params: { ...t.params, imageDir: value } } : t,
                      ),
                    );
                  }}
                  onNClustersChange={(value) => {
                    setTasks((prev) =>
                      prev.map((t) =>
                        t.id === task.id ? { ...t, params: { ...t.params, nClusters: value } } : t,
                      ),
                    );
                  }}
                  onStart={() => onStart(task.id)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                {loading && activeTabKey === `task_${task.id}` ? (
                  <LoadingSpinner />
                ) : task.result ? (
                  <Card
                    style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                    styles={{
                      body: {
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 0,
                        minHeight: 0,
                      },
                    }}
                  >
                    <Tabs
                      activeKey={activeResultTab}
                      onChange={setActiveResultTab}
                      items={[
                        {
                          key: 'statistics',
                          label: '结果统计',
                          children: (
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                              <ResultStatistics
                                result={task.result}
                                onClusterSelect={handleClusterSelectFromStatistics}
                              />
                            </div>
                          ),
                        },
                        {
                          key: 'images',
                          label: '图片列表',
                          children: (
                            <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                              <ImageList images={task.result.images} />
                            </div>
                          ),
                        },
                        {
                          key: 'clusters',
                          label: '分类详情',
                          children: (
                            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                              <ClusterTabs
                                clusters={task.result.clusters}
                                activeClusterId={activeClusterId || undefined}
                                onActiveClusterChange={(id) => setActiveClusterId(id)}
                              />
                            </div>
                          ),
                        },
                      ]}
                      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                      tabBarStyle={{ margin: 0, padding: '0 24px' }}
                      tabBarExtraContent={
                        <button
                          onClick={() => handleSaveResult(task)}
                          disabled={saving}
                          style={{
                            padding: '4px 14px',
                            fontSize: 12,
                            borderRadius: 4,
                            border: '1px solid #1890ff',
                            backgroundColor: saving ? '#f5f5f5' : '#1890ff',
                            color: saving ? '#999' : '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            minWidth: 80,
                          }}
                        >
                          {saving ? '保存中...' : '保存结果'}
                        </button>
                      }
                    />
                  </Card>
                ) : (
                  <ResultPlaceholder />
                )}
              </div>
            </div>
          );
        } else {
          // 检测任务
          const hasClusterResult = task.params.clusterResultId && task.params.clusterResult;
          const hasImageDir = task.params.imageDir.trim();
          const canStartDetection = hasClusterResult && hasImageDir;
          const detectionStarted = task.params.detectionStarted === true;
          const detectionResults = task.params.detectionResults || [];
          const currentResult =
            detectionResults.length > 0
              ? detectionResults[detectionResults.length - 1]
              : null;
          const detectionTotal =
            task.params.detectionTotal && task.params.detectionTotal > 0
              ? task.params.detectionTotal
              : detectionResults.length;
          const progressPercent =
            detectionTotal > 0
              ? Math.round((detectionResults.length / detectionTotal) * 100)
              : 0;

          // 还未开始检测：展示配置页面
          if (!detectionStarted) {
            return (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 24,
                  gap: 16,
                }}
              >
                <Card
                  style={{
                    maxWidth: 600,
                    margin: '0 auto',
                    marginTop: 40,
                  }}
                >
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <div>
                      <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                        选择参考的聚类结果
                      </Text>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        检测任务需要基于已有的聚类结果进行，请先选择一个已保存的聚类结果
                      </Text>
                    </div>
                    <Select
                      placeholder="请选择聚类结果"
                      style={{ width: '100%' }}
                      size="large"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={savedClusterResults.map((item) => ({
                        value: item.id,
                        label: `${item.task_name} (${new Date(item.created_at).toLocaleString()})`,
                        clusterResult: item.clusterResult,
                      }))}
                      onChange={(value, option: any) => {
                        setTasks((prev) =>
                          prev.map((t) =>
                            t.id === task.id
                              ? {
                                  ...t,
                                  params: {
                                    ...t.params,
                                    clusterResultId: value,
                                    clusterResult: option.clusterResult,
                                  },
                                }
                              : t
                          )
                        );
                      }}
                    />
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                        待检测图片目录
                      </Text>
                      <Input
                        placeholder="请输入待检测图片所在的目录路径"
                        size="large"
                        value={task.params.imageDir}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTasks((prev) =>
                            prev.map((t) =>
                              t.id === task.id
                                ? {
                                    ...t,
                                    params: {
                                      ...t.params,
                                      imageDir: value,
                                    },
                                  }
                                : t
                            )
                          );
                        }}
                      />
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 8 }}>
                      <Button
                        type="primary"
                        size="large"
                        disabled={!canStartDetection}
                        onClick={() => onStartDetection(task.id)}
                        style={{ minWidth: 120 }}
                      >
                        开始检测
                      </Button>
                    </div>
                  </Space>
                </Card>
              </div>
            );
          }

          // 已开始检测：展示检测结果页面
          return (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                padding: 24,
                gap: 16,
              }}
            >
              {/* 第一块区域：所有聚类结果的 Lab 胶囊 + 总分类数 + 取消按钮 */}
              <Card bodyStyle={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, overflowX: 'auto' }}>
                    <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
                      {Object.values(task.params.clusterResult!.clusters || {}).map((cluster) => (
                        <div
                          key={cluster.cluster_id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 8px',
                            borderRadius: 999,
                            background: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            whiteSpace: 'nowrap',
                            fontSize: 12,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: 12,
                              height: 12,
                              borderRadius: '999px',
                              backgroundColor: labToRgbColor(
                                cluster.lab_mean[0],
                                cluster.lab_mean[1],
                                cluster.lab_mean[2],
                              ),
                              border: '1px solid rgba(0,0,0,0.06)',
                              marginRight: 6,
                            }}
                          />
                          <span>
                            #{cluster.cluster_id} &nbsp;L
                            {cluster.lab_mean[0].toFixed(1)} a
                            {cluster.lab_mean[1].toFixed(1)} b
                            {cluster.lab_mean[2].toFixed(1)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>
                      总分类数：
                      {Object.keys(task.params.clusterResult!.clusters || {}).length}
                    </div>
                    {task.status === 'running' && (
                      <Button
                        size="small"
                        danger
                        onClick={() => onCancelDetection(task.id)}
                      >
                        取消检测
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* 第二块区域：Card 自带 tab 切换“检测概览 / 检测列表” */}
              <Card
                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
                tabList={[
                  { key: 'overview', tab: '检测概览' },
                  { key: 'list', tab: '检测列表' },
                ]}
                activeTabKey={detectionViewKey}
                onTabChange={(key) => setDetectionViewKey(key as 'overview' | 'list')}
                bodyStyle={{
                  padding: detectionViewKey === 'overview' ? '20px 32px 24px' : 16,
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {detectionViewKey === 'overview' ? (
                  <>
                    {/* 顶部进度条 */}
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                          fontSize: 12,
                          color: '#6b7280',
                        }}
                      >
                        <span>
                          当前进度：已检测 {detectionResults.length} / {detectionTotal || '—'} 张
                        </span>
                        <span>
                          {task.status === 'running'
                            ? '检测进行中...'
                            : detectionResults.length > 0
                            ? '检测已完成'
                            : '等待开始检测'}
                        </span>
                      </div>
                      <Progress
                        percent={progressPercent}
                        size="small"
                        status={
                          task.status === 'error'
                            ? 'exception'
                            : task.status === 'completed'
                            ? 'success'
                            : 'active'
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        gap: 80,
                        alignItems: 'center',
                      }}
                    >
                      {/* 左侧：被检测对象 */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
                          被检测对象
                        </div>
                        <div
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            border: '1px solid #d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 6,
                            backgroundColor:
                              currentResult && currentResult.lab
                                ? labToRgbColor(
                                    currentResult.lab.L,
                                    currentResult.lab.a,
                                    currentResult.lab.b,
                                  )
                                : 'transparent',
                          }}
                        >
                          {currentResult ? (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {currentResult.filename || '新样本'}
                            </Text>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              新样本预览
                            </Text>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', minHeight: 18 }}>
                          {currentResult && currentResult.lab ? (
                            <>
                              Lab：L {currentResult.lab.L.toFixed(1)}，a{' '}
                              {currentResult.lab.a.toFixed(1)}，b{' '}
                              {currentResult.lab.b.toFixed(1)}
                            </>
                          ) : (
                            <span style={{ color: '#9ca3af' }}>Lab 等待计算</span>
                          )}
                        </div>
                      </div>

                      {/* 右侧：命中的类别 */}
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
                          命中的类别
                        </div>
                        <div
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: '50%',
                            border: '1px solid #d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: 6,
                            backgroundColor:
                              currentResult && currentResult.matched_cluster_id !== null
                                ? (() => {
                                    const clusterId = currentResult.matched_cluster_id!;
                                    const cluster =
                                      task.params.clusterResult?.clusters?.[
                                        String(clusterId)
                                      ] || null;
                                    return cluster && cluster.lab_mean
                                      ? labToRgbColor(
                                          cluster.lab_mean[0],
                                          cluster.lab_mean[1],
                                          cluster.lab_mean[2],
                                        )
                                      : 'transparent';
                                  })()
                                : 'transparent',
                          }}
                        >
                          {currentResult && currentResult.matched_cluster_id !== null ? (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              #{currentResult.matched_cluster_id}
                            </Text>
                          ) : (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              未归类
                            </Text>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', minHeight: 18 }}>
                          {currentResult && currentResult.matched_cluster_id !== null ? (
                            (() => {
                              const clusterId = currentResult.matched_cluster_id!;
                              const cluster =
                                task.params.clusterResult?.clusters?.[String(clusterId)] ||
                                null;
                              return cluster && cluster.lab_mean ? (
                                <>
                                  Lab：L {cluster.lab_mean[0].toFixed(1)}，a{' '}
                                  {cluster.lab_mean[1].toFixed(1)}，b{' '}
                                  {cluster.lab_mean[2].toFixed(1)}
                                </>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>分类 Lab 未知</span>
                              );
                            })()
                          ) : (
                            <span style={{ color: '#9ca3af' }}>尚未命中类别</span>
                          )}
                        </div>
                      </div>

                      {/* 最右侧：操作按钮区 */}
                      <div
                        style={{
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        {task.status === 'running' || task.status === 'paused' ? (
                          <Button
                            size="middle"
                            onClick={() => {
                              if (task.status === 'running') {
                                onPauseDetection(task.id);
                              } else if (task.status === 'paused') {
                                onResumeDetection(task.id);
                              }
                            }}
                          >
                            {task.status === 'running' ? '暂停检测' : '继续检测'}
                          </Button>
                        ) : null}
                        <Button
                          type="primary"
                          size="middle"
                          disabled={
                            task.status !== 'completed' ||
                            !detectionResults.length ||
                            savingDetectionTaskId === task.id
                          }
                          loading={savingDetectionTaskId === task.id}
                          onClick={() => handleSaveDetectionResult(task)}
                        >
                          保存结果
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={task.params.detectionResults || []}
                      rowKey={(record, index) => record.filename || String(index)}
                      columns={[
                        { title: '样本图片', dataIndex: 'filename', key: 'filename' },
                        {
                          title: '归属分类',
                          dataIndex: 'matched_cluster_id',
                          key: 'clusterLabel',
                          render: (clusterId: number | null) => {
                            if (clusterId === null)
                              return <Text type="secondary">未归类</Text>;
                            const cluster =
                              task.params.clusterResult?.clusters?.[String(clusterId)];
                            return cluster ? (
                              <Tag color="blue">类别 {clusterId}</Tag>
                            ) : (
                              <Text type="secondary">未知</Text>
                            );
                          },
                        },
                        {
                          title: 'ΔE2000 距离',
                          dataIndex: 'distance',
                          key: 'distance',
                          render: (distance: number | null) =>
                            distance !== null ? distance.toFixed(2) : '-',
                        },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          key: 'status',
                          render: (status: string) => {
                            const statusConfig: Record<string, { color: string }> = {
                              已归类: { color: 'success' },
                              未归类: { color: 'default' },
                              距离过远: { color: 'warning' },
                            };
                            const config = statusConfig[status] || { color: 'default' };
                            return <Tag color={config.color as any}>{status}</Tag>;
                          },
                        },
                      ]}
                      locale={{
                        emptyText: (
                          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description="检测结果列表将在执行检测后展示"
                          />
                        ),
                      }}
                      loading={task.status === 'running'}
                    />
                  </div>
                )}
              </Card>
            </div>
          );
        }
      }

      default:
        return null;
    }
  };

  return (
    <>
      <style>{globalStyle}</style>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          components: {
            Layout: {
              headerBg: isDark ? '#001529' : '#ffffff',
              headerColor: isDark ? '#f9fafb' : '#111827',
              bodyBg: isDark ? '#020617' : '#f5f5f5',
              siderBg: isDark ? '#020617' : '#ffffff',
            },
          },
        }}
      >
        <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
              height: 48,
              lineHeight: '48px',
              borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    { key: 'cluster', label: '聚类任务' },
                    { key: 'detect', label: '检测任务' },
                  ],
                  onClick: ({ key }) => {
                    createTask(key as TaskType);
                  },
                }}
              >
                <div
                  style={{
                    padding: '0 14px',
                    height: 30,
                    lineHeight: '30px',
                    color: isDark ? '#e5e7eb' : '#111827',
                    fontSize: 13,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  新建任务
                </div>
              </Dropdown>
              <span
                style={{
                  color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                  fontSize: 13,
                  margin: '0 8px',
                }}
              >
                |
              </span>
              <div
                onClick={openTaskPanel}
                style={{
                  padding: '0 12px',
                  height: 32,
                  lineHeight: '32px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: '#4b5563',
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                任务面板
              </div>
              <span
                style={{
                  color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                  fontSize: 13,
                  margin: '0 8px',
                }}
              >
                |
              </span>
              <div
                onClick={openSystemParams}
                style={{
                  padding: '0 12px',
                  height: 32,
                  lineHeight: '32px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: '#4b5563',
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                系统参数
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
              <div
                onClick={() => setIsDark((prev) => !prev)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backgroundColor: isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 23, 42, 0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isDark ? (
                  <MoonOutlined style={{ fontSize: 16, color: '#e5e7eb' }} />
                ) : (
                  <SunOutlined style={{ fontSize: 16, color: '#f59e0b' }} />
                )}
              </div>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>版本号 v1.0.0</Text>
            </div>
          </Header>
          <Layout style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            <Sider
              width={180}
              collapsedWidth={56}
              collapsible
              collapsed={siderCollapsed}
              trigger={null}
              style={{
                borderRight: '1px solid rgba(5,5,5,0.06)',
                display: 'flex',
                flexDirection: 'column',
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: siderCollapsed ? 4 : 8,
                paddingRight: siderCollapsed ? 4 : 8,
                rowGap: 8,
              }}
            >
              {[
                { key: 'taskPanel', label: '任务列表', icon: <UnorderedListOutlined />, onClick: openTaskPanel },
                { key: 'systemParams', label: '系统参数', icon: <SettingOutlined />, onClick: openSystemParams },
              ].map((item) => (
                <div
                  key={item.key}
                  onClick={item.onClick}
                  style={{
                    height: 40,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: siderCollapsed ? 'center' : 'flex-start',
                    padding: siderCollapsed ? '0 4px' : '0 12px',
                    gap: siderCollapsed ? 0 : 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    color: '#4b5563',
                    fontWeight: 500,
                    backgroundColor: 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>
                    {item.icon}
                  </span>
                  {!siderCollapsed && <span>{item.label}</span>}
                </div>
              ))}
              <div style={{ flex: 1 }} />
              <div
                onClick={() => setSiderCollapsed((prev) => !prev)}
                style={{
                  height: 32,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  marginTop: 8,
                  color: isDark ? '#e5e7eb' : '#4b5563',
                  backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(148,163,184,0.18)',
                  transition: 'all 0.15s ease',
                }}
              >
                {siderCollapsed ? <RightOutlined /> : <LeftOutlined />}
              </div>
            </Sider>
            <Content
              style={{
                flex: 1,
                minWidth: 0,
                padding: '16px 24px 24px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {tabs.length === 0 ? (
                <Card
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text type="secondary">
                    暂无打开的页面，请通过顶部"新建任务"创建任务，或点击"任务面板"查看任务列表。
                  </Text>
                </Card>
              ) : (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext items={tabs.map((t) => t.key)} strategy={horizontalListSortingStrategy}>
                    <div className="root-tabs" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Tabs
                        type="editable-card"
                        activeKey={activeTabKey || undefined}
                        onChange={(key) => setActiveTabKey(key)}
                        onEdit={handleTabEdit}
                        addIcon={
                          <Dropdown
                            trigger={['click']}
                            menu={{
                              items: [
                                { key: 'cluster', label: '聚类任务' },
                                { key: 'detect', label: '检测任务' },
                              ],
                              onClick: ({ key }) => {
                                createTask(key as TaskType);
                              },
                            }}
                          >
                            <span style={{ display: 'inline-block', width: 20, textAlign: 'center' }}>+</span>
                          </Dropdown>
                        }
                        renderTabBar={(tabBarProps, DefaultTabBar) => (
                          <DefaultTabBar {...tabBarProps}>
                            {(node) => (
                              <DraggableTabNode key={node.key} data-node-key={node.key as string}>
                                {node}
                              </DraggableTabNode>
                            )}
                          </DefaultTabBar>
                        )}
                        items={tabs.map((tab) => ({
                          key: tab.key,
                          label: (
                            <Dropdown
                              menu={{ items: getTabContextMenuItems(tab.key) }}
                              trigger={['contextMenu']}
                            >
                              {tab.type === 'task' && editingTaskId === tab.taskId ? (
                                <Input
                                  value={editingTaskName}
                                  onChange={(e) => setEditingTaskName(e.target.value)}
                                  onBlur={() => handleTaskNameBlur(tab.taskId!)}
                                  onKeyDown={(e) => handleTaskNameKeyDown(e, tab.taskId!)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  size="small"
                                  style={{ width: 120 }}
                                />
                              ) : (
                                <span
                                  onDoubleClick={() => {
                                    if (tab.type === 'task' && tab.taskId) {
                                      handleTabDoubleClick(tab.taskId);
                                    }
                                  }}
                                  title={tab.label}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '8px 12px',
                                    margin: '-8px -12px',
                                    maxWidth: 140,
                                  }}
                                >
                                  {tab.isPinned && (
                                    <PushpinFilled style={{ fontSize: 12, color: '#1890ff' }} />
                                  )}
                                  <span
                                    style={{
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {tab.label}
                                  </span>
                                </span>
                              )}
                            </Dropdown>
                          ),
                          closable: tab.closable && !tab.isPinned,
                          children: renderTabContent(tab),
                        }))}
                        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                        tabBarStyle={{ marginBottom: 0 }}
                      />
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </Content>
          </Layout>
        </Layout>
      </ConfigProvider>
    </>
  );
};

export default App;
