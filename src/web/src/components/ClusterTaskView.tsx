import React, { useState } from 'react';
import { Card, Tabs, Button, theme } from 'antd';
import { Task } from '../types';
import ParameterConfig from './ParameterConfig';
import LoadingSpinner from './LoadingSpinner';
import ResultStatistics from './ResultStatistics';
import ImageList from './ImageList';
import ClusterTabs from './ClusterTabs';
import ResultPlaceholder from './ResultPlaceholder';
import { useTaskStore } from '../store/useTaskStore';
import { useTasks } from '../hooks/useTasks';

interface ClusterTaskViewProps {
  taskId: string;
}

export const ClusterTaskView: React.FC<ClusterTaskViewProps> = ({
  taskId,
}) => {
  const { token } = theme.useToken();
  const [activeResultTab, setActiveResultTab] = useState<string>('statistics');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);

  // 从 Store 获取任务数据
  const task = useTaskStore((state) => state.tasks.find((t) => t.id === taskId));
  
  // 使用 useTasks hook 获取操作方法 (注意：这里会创建新的状态实例，但对于操作方法来说没问题)
  // 为了避免 loading/saving 状态丢失，我们需要看 useTasks 里的实现
  // useTasks 内部使用了 useCluster，useCluster 有自己的 loading/saving 状态
  // 这意味着如果我们在 App 和 ClusterTaskView 分别调用 useTasks，它们会有各自的 loading 状态。
  // 这实际上是正确的：每个 TaskView 应该有自己的 loading 状态。
  const { 
    updateTaskParams, 
    onStart, 
    handleSaveResult,
    loading, 
    saving,
    loadTaskDetail // 引入加载详情方法
  } = useTasks();

  // 组件挂载时检查是否需要加载详情
  React.useEffect(() => {
    // 如果是已保存的任务，且没有结果数据，且没有正在加载，则加载详情
    if (task.isSaved && !task.result && !task.isLoadingDetail) {
      loadTaskDetail(task);
    }
  }, [task.isSaved, task.result, task.isLoadingDetail, loadTaskDetail, task]);

  if (!task) return null;

  const handleClusterSelectFromStatistics = (clusterId: number) => {
    setActiveResultTab('clusters');
    setActiveClusterId(String(clusterId));
  };

  const tabsItems = React.useMemo(() => {
    if (!task.result) {
      return [];
    }
    return [
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
          <ImageList 
            images={task.result.images} 
            taskId={task.id}
            taskDbId={task.dbId}
            isSaved={task.isSaved}
          />
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
            onActiveClusterChange={setActiveClusterId}
          />
        </div>
      ),
    },
  ];
  }, [task.result, activeClusterId]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      padding: 0,
      gap: 0,
      minHeight: 0,
      overflow: 'hidden',
      backgroundColor: token.colorBgContainer
    }}>
      <div style={{
        flex: '0 0 320px',
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        padding: '24px 0 24px 24px'
      }}>
        <ParameterConfig
          imageDir={task.params.imageDir}
          nClusters={task.params.nClusters}
          loading={loading}
          onImageDirChange={(value) => {
            updateTaskParams(task.id, { imageDir: value });
          }}
          onNClustersChange={(value) => {
            updateTaskParams(task.id, { nClusters: value });
          }}
          onStart={() => onStart(task.id)}
        />
      </div>
      <div style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: 24
      }}>
        {loading || task.isLoadingDetail ? (
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
              destroyInactiveTabPane={true}
              animated={false}
              items={tabsItems}
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
};
