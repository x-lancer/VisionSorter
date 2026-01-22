import { useState, useCallback } from 'react';
import { TabItem, TabType, TASK_PANEL_KEY, SYSTEM_PARAMS_KEY } from '../types';

export const useTabs = () => {
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabKey, setActiveTabKey] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');

  // 初始化默认 Tab
  const initializeDefaultTabs = useCallback(() => {
    setTabs([
      { key: SYSTEM_PARAMS_KEY, type: 'systemParams', label: '系统参数', closable: true, isPinned: true },
      { key: TASK_PANEL_KEY, type: 'taskPanel', label: '任务面板', closable: true, isPinned: true },
    ]);
    setActiveTabKey(TASK_PANEL_KEY);
  }, []);

  // 打开或切换到指定 Tab
  const openOrSwitchTab = useCallback((
    key: string,
    type: TabType,
    label: string,
    closable: boolean,
    taskId?: string,
    initialTask?: any
  ) => {
    setTabs((prev) => {
      const existingTab = prev.find((tab) => tab.key === key);
      if (existingTab) {
        return prev;
      }
      return [...prev, { key, type, label, closable, taskId, initialTask }];
    });
    // 确保激活 Tab（无论是否是新 Tab 还是已存在的 Tab）
    setActiveTabKey(key);
  }, []);

  // 打开任务面板
  const openTaskPanel = useCallback(() => {
    openOrSwitchTab(TASK_PANEL_KEY, 'taskPanel', '任务面板', true);
  }, [openOrSwitchTab]);

  // 打开系统参数
  const openSystemParams = useCallback(() => {
    openOrSwitchTab(SYSTEM_PARAMS_KEY, 'systemParams', '系统参数', true);
  }, [openOrSwitchTab]);

  // 打开任务详情
  const openTaskDetail = useCallback((taskId: string, taskName: string, task?: any) => {
    const tabKey = `task_${taskId}`;
    openOrSwitchTab(tabKey, 'task', taskName, true, taskId, task);
  }, [openOrSwitchTab]);

  // 关闭 Tab
  const closeTab = useCallback((targetKey: string) => {
    setTabs((prev) => {
      const targetIndex = prev.findIndex((tab) => tab.key === targetKey);
      const newTabs = prev.filter((tab) => tab.key !== targetKey);
      
      // 如果关闭的是当前激活的 Tab，需要切换到其他 Tab
      if (activeTabKey === targetKey && newTabs.length > 0) {
        // 优先切换到右边的 Tab，否则切换到左边的
        const newActiveIndex = targetIndex >= newTabs.length ? newTabs.length - 1 : targetIndex;
        setActiveTabKey(newTabs[newActiveIndex].key);
      } else if (newTabs.length === 0) {
        setActiveTabKey(null);
      }
      
      return newTabs;
    });
  }, [activeTabKey]);

  // 固定/取消固定 Tab
  const togglePinTab = useCallback((targetKey: string) => {
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
  }, []);

  // 处理 Tab 编辑（关闭）
  const handleTabEdit = useCallback((
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) => {
    if (action === 'remove' && typeof targetKey === 'string') {
      closeTab(targetKey);
    }
  }, [closeTab]);

  // Tab 重命名相关
  const handleTabDoubleClick = useCallback((taskId: string, currentName: string) => {
    setEditingTaskId(taskId);
    setEditingTaskName(currentName);
  }, []);

  const handleTaskNameChange = useCallback((taskId: string, newName: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.taskId === taskId ? { ...tab, label: newName } : tab))
    );
    setEditingTaskId(null);
    setEditingTaskName('');
    return newName;
  }, []);

  const handleTaskNameBlur = useCallback((taskId: string) => {
    if (editingTaskName.trim()) {
      return handleTaskNameChange(taskId, editingTaskName.trim());
    } else {
      setEditingTaskId(null);
      setEditingTaskName('');
      return null;
    }
  }, [editingTaskName, handleTaskNameChange]);

  const handleTaskNameKeyDown = useCallback((e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter') {
      if (editingTaskName.trim()) {
        handleTaskNameChange(taskId, editingTaskName.trim());
      }
    } else if (e.key === 'Escape') {
      setEditingTaskId(null);
      setEditingTaskName('');
    }
  }, [editingTaskName, handleTaskNameChange]);

  // Tab 右键菜单
  const getTabContextMenuItems = useCallback((tabKey: string, onRename?: () => void) => {
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
          if (onRename) {
            onRename();
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
          setTabs((prev) => {
            const filtered = prev.filter((t) => t.key === tabKey || t.isPinned);
            setActiveTabKey(tabKey);
            return filtered;
          });
        },
        disabled: tabs.length <= 1,
      },
      {
        key: 'closeAll',
        label: '关闭所有标签页',
        onClick: () => {
          // 只保留固定的 Tab
          setTabs((prev) => {
            const pinnedTabs = prev.filter((t) => t.isPinned);
            setActiveTabKey(pinnedTabs.length > 0 ? pinnedTabs[0].key : null);
            return pinnedTabs;
          });
        },
        disabled: tabs.every((t) => t.isPinned),
      },
    ];
  }, [tabs, togglePinTab, closeTab]);

  // 更新 Tab 标签（用于任务重命名后同步）
  const updateTabLabel = useCallback((taskId: string, newLabel: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.taskId === taskId ? { ...tab, label: newLabel } : tab))
    );
  }, []);

  return {
    tabs,
    setTabs,
    activeTabKey,
    setActiveTabKey,
    editingTaskId,
    editingTaskName,
    setEditingTaskName,
    initializeDefaultTabs,
    openOrSwitchTab,
    openTaskPanel,
    openSystemParams,
    openTaskDetail,
    closeTab,
    togglePinTab,
    handleTabEdit,
    handleTabDoubleClick,
    handleTaskNameChange,
    handleTaskNameBlur,
    handleTaskNameKeyDown,
    getTabContextMenuItems,
    updateTabLabel,
  };
};
