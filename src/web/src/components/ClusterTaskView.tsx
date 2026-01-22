import React from 'react';
import { Card, Tabs, Button, theme } from 'antd';
import { Task } from '../types';
import ParameterConfig from './ParameterConfig';
import LoadingSpinner from './LoadingSpinner';
import ResultStatistics from './ResultStatistics';
import ImageList from './ImageList';
import ClusterTabs from './ClusterTabs';
import ResultPlaceholder from './ResultPlaceholder';

interface ClusterTaskViewProps {
  task: Task;
  loading: boolean;
  activeResultTab: string;
  activeClusterId: string | null;
  saving: boolean;
  onUpdateTaskParams: (taskId: string, params: Partial<Task['params']>) => void;
  onStart: (taskId: string) => void;
  onSaveResult: (task: Task) => void;
  onClusterSelectFromStatistics: (clusterId: number) => void;
  onActiveResultTabChange: (key: string) => void;
  onActiveClusterIdChange: (id: string | null) => void;
}

export const ClusterTaskView: React.FC<ClusterTaskViewProps> = ({
  task,
  loading,
  activeResultTab,
  activeClusterId,
  saving,
  onUpdateTaskParams,
  onStart,
  onSaveResult,
  onClusterSelectFromStatistics,
  onActiveResultTabChange,
  onActiveClusterIdChange,
}) => {
  const { token } = theme.useToken();
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
            onUpdateTaskParams(task.id, { imageDir: value });
          }}
          onNClustersChange={(value) => {
            onUpdateTaskParams(task.id, { nClusters: value });
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
        {loading ? (
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
              onChange={onActiveResultTabChange}
              destroyInactiveTabPane={true}
              animated={false}
              items={[
                {
                  key: 'statistics',
                  label: '结果统计',
                  children: (
                    <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      <ResultStatistics
                        result={task.result}
                        onClusterSelect={onClusterSelectFromStatistics}
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
                        onActiveClusterChange={onActiveClusterIdChange}
                      />
                    </div>
                  ),
                },
              ]}
              style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
              tabBarStyle={{ margin: 0, padding: '0 24px' }}
              tabBarExtraContent={
                <button
                  onClick={() => onSaveResult(task)}
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
