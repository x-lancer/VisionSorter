import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Typography, Tabs, Card, Dropdown, ConfigProvider, theme, Input } from 'antd';
import { PushpinFilled } from '@ant-design/icons';
import TaskList from './components/TaskList';
import { DraggableTabs } from './components/DraggableTabs';
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
    loadSavedResults,
    createTask,
    handleDeleteTask,
  } = useTasks();

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

  // 处理任务重命名 (现在不需要在这里更新 Store 了，useTabs 里的 Input 会更新 Tab Label，但 Task Name 的更新需要处理)
  // useTabs 的 handleTaskNameChange 只是更新了 Tab 的 label
  // 我们需要在那里调用 updateTaskName
  
  // 实际上，之前的逻辑是 useTabs 处理 Tab UI，App.tsx 协调 Task Name 更新
  // 我们需要在 App.tsx 中保留更新 Task Name 的逻辑
  const { updateTaskName } = useTasks();

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
        if (!tab.taskId) {
          return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary">任务 ID 丢失</Text>
            </div>
          );
        }

        // 检查任务是否存在
        const taskExists = tasks.some(t => t.id === tab.taskId);
        if (!taskExists && !tab.initialTask) {
           return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary">任务不存在或已被删除</Text>
            </div>
          );
        }
        
        // 即使任务不存在，如果是个刚创建的任务，store 更新可能滞后? 不会，store 是同步的。
        // 但是初始渲染时可能为空。
        
        // 这里的判断主要是为了确定显示哪个 View
        // 为了确定类型，我们可能需要先获取 task
        // 但是 renderTabContent 是在 map 中调用的，尽量减少 find 操作
        // 我们可以依赖 TabItem 中的信息吗？ TabItem 目前没有 type 区分 cluster/detect (除了 tab.type='task')
        // 我们需要去 tasks 里查。
        const task = tasks.find(t => t.id === tab.taskId) || tab.initialTask;
        
        if (!task) {
             return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary">任务不存在</Text>
            </div>
          );
        }

        if (task.type === 'cluster') {
          return <ClusterTaskView taskId={tab.taskId!} />;
        } else {
          return <DetectionTaskView taskId={tab.taskId!} />;
        }
      }

      default:
        return null;
    }
  }, [tasks, handleDeleteTask, handleOpenTaskDetail]);

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
                <DraggableTabs
                  tabs={tabs}
                  activeTabKey={activeTabKey}
                  onTabsChange={setTabs}
                  onActiveTabChange={setActiveTabKey}
                  onTabEdit={handleTabEdit}
                  onAddClick={handleCreateTask}
                  items={tabItems}
                />
              )}
            </Content>
          </Layout>
        </Layout>
      </ConfigProvider>
    </>
  );
};

export default App;
