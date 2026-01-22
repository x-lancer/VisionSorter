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
  const defaultActiveKey = String(sortedClusters[0]?.cluster_id ?? '0');
  const activeKey = activeClusterId ?? defaultActiveKey;

  return (
    <div>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => {
          if (onActiveClusterChange) {
            onActiveClusterChange(key);
          }
        }}
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
      />
    </div>
  );
};

export default ClusterTabs;

