import React, { useMemo, useState } from 'react';
import { Empty, Tabs, Tag, Typography } from 'antd';
import type { ClusterResult } from '../types';
import { TaskImagesGrid } from './TaskImagesGrid';

const { Text } = Typography;

export interface DetectionClassDetailsProps {
  taskDbId: number;
  clusterResult?: ClusterResult;
  statistics?: Record<string, number>;
}

export const DetectionClassDetails: React.FC<DetectionClassDetailsProps> = ({
  taskDbId,
  clusterResult,
  statistics,
}) => {
  const [activeKey, setActiveKey] = useState<string>('-1');

  const clusterKeys = useMemo(() => {
    const keys = Object.keys(clusterResult?.clusters || {});
    keys.sort((a, b) => Number(a) - Number(b));
    return keys;
  }, [clusterResult?.clusters]);

  const items = useMemo(() => {
    if (!clusterResult?.clusters || clusterKeys.length === 0) return [];

    const mkLabel = (cidStr: string) => {
      const count = statistics?.[cidStr];
      return (
        <span>
          <Tag color="blue" style={{ marginInlineEnd: 6 }}>
            类别 {cidStr}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {typeof count === 'number' ? `${count} 张` : ''}
          </Text>
        </span>
      );
    };

    const list = clusterKeys.map((cidStr) => ({
      key: cidStr,
      label: mkLabel(cidStr),
      children: (
        <TaskImagesGrid
          taskType="detect"
          taskDbId={taskDbId}
          clusterId={Number(cidStr)}
          pageSize={20}
          emptyText="该分类暂无图片"
        />
      ),
    }));

    // 未归类
    const unclassifiedCount = statistics?.['-1'];
    list.unshift({
      key: '-1',
      label: (
        <span>
          <Tag color="default" style={{ marginInlineEnd: 6 }}>
            未归类
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {typeof unclassifiedCount === 'number' ? `${unclassifiedCount} 张` : ''}
          </Text>
        </span>
      ),
      children: (
        <TaskImagesGrid
          taskType="detect"
          taskDbId={taskDbId}
          clusterId={-1}
          pageSize={20}
          emptyText="暂无未归类图片"
        />
      ),
    });

    return list;
  }, [clusterKeys, clusterResult?.clusters, statistics, taskDbId]);

  if (!clusterResult?.clusters || clusterKeys.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="无法加载分类信息（可能是旧版本保存记录）" />
      </div>
    );
  }

  const safeActiveKey = items.find((i) => i.key === activeKey)?.key ?? items[0]?.key ?? '-1';

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <Tabs
        tabPosition="left"
        activeKey={safeActiveKey}
        onChange={setActiveKey}
        destroyInactiveTabPane
        items={items as any}
        style={{ height: '100%' }}
      />
    </div>
  );
};

