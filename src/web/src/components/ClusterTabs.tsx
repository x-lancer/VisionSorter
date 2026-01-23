import React, { useMemo } from 'react';
import { Tabs, Space, Tag, Typography } from 'antd';
import ClusterCard from './ClusterCard';
import { ClusterInfo } from '../types';

const { Text } = Typography;

interface ClusterTabsProps {
  clusters: Record<string, ClusterInfo>;
  activeClusterId?: string;
  onActiveClusterChange?: (clusterId: string) => void;
}

const ClusterTabs: React.FC<ClusterTabsProps> = ({
  clusters,
  activeClusterId,
  onActiveClusterChange,
}) => {
  const sortedClusters = useMemo(
    () => Object.values(clusters).sort((a, b) => a.cluster_id - b.cluster_id),
    [clusters],
  );
  
  // 确保 activeKey 是有效的
  // 如果 activeClusterId 无效（未定义或不在 clusters 中），回退到第一个有效分类
  const activeKey = React.useMemo(() => {
    if (activeClusterId && clusters[activeClusterId]) {
      return activeClusterId;
    }
    return String(sortedClusters[0]?.cluster_id ?? '0');
  }, [activeClusterId, clusters, sortedClusters]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => {
          console.log('ClusterTabs onChange:', key);
          if (onActiveClusterChange) {
            onActiveClusterChange(key);
          }
        }}
        destroyInactiveTabPane={true}
        items={sortedClusters.map((cluster) => {
          return {
            key: String(cluster.cluster_id),
            label: (
              <Space>
                <Tag color="blue">类别 {cluster.cluster_id}</Tag>
                <Text>{cluster.count} 张</Text>
              </Space>
            ),
            children: <ClusterCard cluster={cluster} />,
          };
        })}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ margin: 0, padding: '0 8px' }}
      />
    </div>
  );
};

export default ClusterTabs;

