import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Typography, Tabs, Card, Dropdown, ConfigProvider, theme, Input } from 'antd';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { PushpinFilled } from '@ant-design/icons';
import TaskList from './components/TaskList';
import { DraggableTabNode } from './components/DraggableTabNode';
import { AppHeader } from './components/AppHeader';
import { AppSider } from './components/AppSider';
import { ClusterTaskView } from './components/ClusterTaskView';
import { DetectionTaskView } from './components/DetectionTaskView';
import { useTabs } from './hooks/useTabs';
import { useTasks } from './hooks/useTasks';
import { globalStyle } from './styles/globalStyles';
import { TabItem, TaskType, Task } from './types';

const { Content } = Layout;
const { Text } = Typography;

const App: React.FC = () => {
  // UI 状态
  const [isDark, setIsDark] = useState<boolean>(false);
  const [siderCollapsed, setSiderCollapsed] = useState<boolean>(true);

  // Tab 管理
  const {
    tabs,
    setTabs,
    activeTabKey,
    setActiveTabKey,
    editingTaskId,
    editingTaskName,
    setEditingTaskName,
    initializeDefaultTabs,
    openTaskPanel,
    openSystemParams,
    openTaskDetail,
    handleTabEdit,
    handleTabDoubleClick,
    handleTaskNameBlur,
    handleTaskNameKeyDown,
    getTabContextMenuItems,
    updateTabLabel,
  } = useTabs();

  // 任务管理
  const {
    tasks,
    savedClusterResults,
    activeResultTab,
    setActiveResultTab,
    activeClusterId,
    setActiveClusterId,
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
  } = useTasks();

  // 拖拽排序相关
  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 10 } });
  const sensors = useSensors(sensor);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const activeIndex = tabs.findIndex((tab) => tab.key === active.id);
      const overIndex = tabs.findIndex((tab) => tab.key === over.id);
      const newTabs = arrayMove(tabs, activeIndex, overIndex);
      setTabs(newTabs);
    }
  };

  // 组件挂载时初始化
  useEffect(() => {
    loadSavedResults();
    initializeDefaultTabs();
  }, [loadSavedResults, initializeDefaultTabs]);

  // 创建任务并打开
  const handleCreateTask = (type: TaskType) => {
    const newTask = createTask(type);
    // 立即打开 Tab，并传入任务对象作为初始数据，解决状态同步问题
    openTaskDetail(newTask.id, newTask.name, newTask);
  };

  // 打开任务详情
  const handleOpenTaskDetail = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      openTaskDetail(taskId, task.name);
    }
  };

  // 处理任务重命名
  const handleTaskRename = (taskId: string, newName: string) => {
    updateTaskName(taskId, newName);
    updateTabLabel(taskId, newName);
  };

  // 渲染 Tab 内容 - 使用 useCallback 确保函数引用稳定
  const renderTabContent = useCallback((tab: TabItem) => {
    switch (tab.type) {
      case 'taskPanel':
        return (
          <Card
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { flex: 1, overflow: 'auto', padding: 24 } }}
          >
            <TaskList
              tasks={tasks}
              onViewTask={handleOpenTaskDetail}
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
        // 先从 tasks 中查找，如果找不到，使用 Tab 中保存的初始任务数据
        let task = tab.taskId ? tasks.find((t) => t.id === tab.taskId) : undefined;
        if (!task && tab.initialTask) {
          task = tab.initialTask;
        }
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
            <ClusterTaskView
              task={task}
              loading={loading && activeTabKey === `task_${task.id}`}
              activeResultTab={activeResultTab}
              activeClusterId={activeClusterId}
              saving={saving}
              onUpdateTaskParams={updateTaskParams}
              onStart={onStart}
              onSaveResult={handleSaveResult}
              onClusterSelectFromStatistics={handleClusterSelectFromStatistics}
              onActiveResultTabChange={setActiveResultTab}
              onActiveClusterIdChange={setActiveClusterId}
            />
          );
        } else {
          return (
            <DetectionTaskView
              task={task}
              savedClusterResults={savedClusterResults}
              detectionViewKey={detectionViewKey}
              searchText={searchText}
              filterClusterId={filterClusterId}
              filterStatus={filterStatus}
              savingDetectionTaskId={savingDetectionTaskId}
              onUpdateTaskParams={updateTaskParams}
              onStartDetection={onStartDetection}
              onCancelDetection={onCancelDetection}
              onPauseDetection={onPauseDetection}
              onResumeDetection={onResumeDetection}
              onSaveDetectionResult={handleSaveDetectionResult}
              onDetectionViewKeyChange={setDetectionViewKey}
              onSearchTextChange={setSearchText}
              onFilterClusterIdChange={setFilterClusterId}
              onFilterStatusChange={setFilterStatus}
            />
          );
        }
      }

      default:
        return null;
    }
  }, [tasks, loading, activeTabKey, activeResultTab, activeClusterId, saving, savingDetectionTaskId, savedClusterResults, detectionViewKey, searchText, filterClusterId, filterStatus, updateTaskParams, onStart, handleSaveResult, handleClusterSelectFromStatistics, setActiveResultTab, setActiveClusterId, onStartDetection, onCancelDetection, onPauseDetection, onResumeDetection, handleSaveDetectionResult, setDetectionViewKey, setSearchText, setFilterClusterId, setFilterStatus, handleOpenTaskDetail, handleDeleteTask]);

  // 使用 useMemo 优化性能，确保在 tasks 或 tabs 更新时重新创建
  const tabItems = useMemo(() => {
    return tabs.map((tab) => {
      // 为每个 tab 生成稳定的 key，避免频繁重新创建影响内部组件状态
      const contentKey = `tab_${tab.key}`;
      
      return {
        key: tab.key,
        label: (
          <Dropdown
            menu={{
              items: getTabContextMenuItems(tab.key, () => {
                if (tab.type === 'task' && tab.taskId) {
                  const task = tasks.find((t) => t.id === tab.taskId);
                  if (task) {
                    handleTabDoubleClick(tab.taskId, task.name);
                  }
                }
              }),
            }}
            trigger={['contextMenu']}
          >
            {tab.type === 'task' && editingTaskId === tab.taskId ? (
              <Input
                value={editingTaskName}
                onChange={(e) => setEditingTaskName(e.target.value)}
                onBlur={() => {
                  const newName = handleTaskNameBlur(tab.taskId!);
                  if (newName) {
                    handleTaskRename(tab.taskId!, newName);
                  }
                }}
                onKeyDown={(e) => {
                  handleTaskNameKeyDown(e, tab.taskId!);
                  if (e.key === 'Enter' && editingTaskName.trim()) {
                    handleTaskRename(tab.taskId!, editingTaskName.trim());
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                size="small"
                style={{ width: 120 }}
              />
            ) : (
              <span
                onDoubleClick={() => {
                  if (tab.type === 'task' && tab.taskId) {
                    const task = tasks.find((t) => t.id === tab.taskId);
                    if (task) {
                      handleTabDoubleClick(tab.taskId, task.name);
                    }
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
        children: (
          <div key={contentKey} style={{ height: '100%' }}>
            {renderTabContent(tab)}
          </div>
        ),
      };
    });
  }, [tabs, tasks, editingTaskId, editingTaskName, getTabContextMenuItems, handleTabDoubleClick, handleTaskNameBlur, handleTaskNameKeyDown, handleTaskRename, setEditingTaskName, renderTabContent]);

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
          <AppHeader
            isDark={isDark}
            onToggleDark={() => setIsDark((prev) => !prev)}
            onCreateTask={handleCreateTask}
            onOpenTaskPanel={openTaskPanel}
            onOpenSystemParams={openSystemParams}
          />
          <Layout style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            <AppSider
              isDark={isDark}
              collapsed={siderCollapsed}
              onToggleCollapse={() => setSiderCollapsed((prev) => !prev)}
              onOpenTaskPanel={openTaskPanel}
              onOpenSystemParams={openSystemParams}
            />
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
                        destroyInactiveTabPane={true}
                        animated={false}
                        addIcon={
                          <Dropdown
                            trigger={['click']}
                            menu={{
                              items: [
                                { key: 'cluster', label: '聚类任务' },
                                { key: 'detect', label: '检测任务' },
                              ],
                              onClick: ({ key }) => {
                                handleCreateTask(key as TaskType);
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
                        items={tabItems}
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
