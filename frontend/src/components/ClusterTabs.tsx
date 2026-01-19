import React, { useState } from 'react';
import { Tabs, Space, Tag, Typography } from 'antd';
import ClusterCard from './ClusterCard';
import { ClusterInfo } from '../types';

const { Text } = Typography;

interface ClusterTabsProps {
  clusters: Record<string, ClusterInfo>;
}

const ClusterTabs: React.FC<ClusterTabsProps> = ({ clusters }) => {
  const sortedClusters = Object.values(clusters).sort((a, b) => a.cluster_id - b.cluster_id);
  const [activeTab, setActiveTab] = useState<string>(String(sortedClusters[0]?.cluster_id || '0'));

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={sortedClusters.map((cluster) => {
          const displayId = cluster.cluster_id + 1; // 显示时从1开始
          return {
            key: String(cluster.cluster_id),
            label: (
              <Space>
                <Tag color="blue">类别 {displayId}</Tag>
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

