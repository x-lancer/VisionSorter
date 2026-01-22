import React from 'react';
import { Table, Empty, Tag, Typography } from 'antd';
import { DetectionResult, ClusterResult } from '../types';

const { Text } = Typography;

interface DetectionListProps {
  detectionResults: DetectionResult[];
  clusterResult: ClusterResult;
  taskStatus: string;
  searchText: string;
  filterClusterId: number | null;
  onSearchTextChange: (value: string) => void;
  onFilterClusterIdChange: (value: number | null) => void;
}

export const DetectionList: React.FC<DetectionListProps> = ({
  detectionResults,
  clusterResult,
  taskStatus,
  searchText,
  filterClusterId,
}) => {
  const filteredResults = detectionResults.filter((result: DetectionResult) => {
    // 搜索过滤
    if (searchText && !result.filename.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    // 分类过滤
    if (filterClusterId !== null) {
      if (filterClusterId === -1) {
        // 筛选未归类
        if (result.matched_cluster_id !== null) {
          return false;
        }
      } else {
        // 筛选特定类别
        if (result.matched_cluster_id !== filterClusterId) {
          return false;
        }
      }
    }
    return true;
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 16 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table
          size="small"
          dataSource={filteredResults}
          rowKey={(record, index) => record.filename || String(index)}
          scroll={{ x: 'max-content' }}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100', '200'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          columns={[
            { title: '样本图片', dataIndex: 'filename', key: 'filename', width: 200 },
            {
              title: '归属分类',
              dataIndex: 'matched_cluster_id',
              key: 'clusterLabel',
              width: 120,
              render: (clusterId: number | null) => {
                if (clusterId === null)
                  return <Text type="secondary">未归类</Text>;
                const cluster = clusterResult?.clusters?.[String(clusterId)];
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
              width: 120,
              render: (distance: number | null) =>
                distance !== null ? distance.toFixed(2) : '-',
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 100,
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
            {
              title: '检测耗时(毫秒)',
              dataIndex: 'elapsed_time',
              key: 'elapsed_time',
              width: 140,
              render: (elapsedTime: number | undefined) =>
                elapsedTime !== undefined ? `${elapsedTime} ms` : '-',
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
          loading={taskStatus === 'running'}
        />
      </div>
    </div>
  );
};
