import React, { useEffect, useState, useCallback } from 'react';
import { Table, Empty, Tag, Typography } from 'antd';
import axios from 'axios';
import { DetectionResult, ClusterResult } from '../types';
import { API_BASE_URL } from '../constants';

const { Text } = Typography;

interface DetectionListProps {
  detectionResults: DetectionResult[];
  clusterResult: ClusterResult;
  taskStatus: string;
  searchText: string;
  filterClusterId: number | null;
  onSearchTextChange: (value: string) => void;
  onFilterClusterIdChange: (value: number | null) => void;
  taskId?: string;
  taskDbId?: number;
  isSaved?: boolean;
}

export const DetectionList: React.FC<DetectionListProps> = ({
  detectionResults,
  clusterResult,
  taskStatus,
  searchText,
  filterClusterId,
  taskDbId,
  isSaved
}) => {
  // 服务端分页状态
  const [serverResults, setServerResults] = useState<DetectionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // 判定模式：如果是已保存任务，且本地无结果（说明是新版轻量加载），且非正在运行中
  const isServerMode = isSaved && !!taskDbId && (!detectionResults || detectionResults.length === 0) && taskStatus !== 'running';

  const fetchResults = useCallback(async (page = 1, pageSize = 20, search = '', clusterId: number | null = null) => {
    if (!taskDbId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/task-images/detect/${taskDbId}`, {
        params: { 
          page, 
          pageSize, 
          search,
          clusterId: clusterId ?? undefined 
        }
      });
      if (response.data.success) {
        setServerResults(response.data.data.items);
        setPagination({
          current: response.data.data.page,
          pageSize: response.data.data.pageSize,
          total: response.data.data.total
        });
      }
    } catch (error) {
      console.error('Failed to fetch detection results:', error);
    } finally {
      setLoading(false);
    }
  }, [taskDbId]);

  // 监听过滤条件变化（带防抖）
  useEffect(() => {
    if (isServerMode) {
      const timer = setTimeout(() => {
        fetchResults(1, pagination.pageSize, searchText, filterClusterId);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isServerMode, searchText, filterClusterId, taskDbId]); // pagination.pageSize dependency omitted to avoid double fetch on size change? No, size change is handled by handleTableChange

  // 翻页处理
  const handleTableChange = (newPagination: any) => {
    if (isServerMode) {
      fetchResults(newPagination.current, newPagination.pageSize, searchText, filterClusterId);
    }
  };

  const filteredResults = React.useMemo(() => {
    if (isServerMode) return [];
    return detectionResults.filter((result: DetectionResult) => {
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
  }, [detectionResults, searchText, filterClusterId, isServerMode]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 16 }}>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Table
          size="small"
          dataSource={isServerMode ? serverResults : filteredResults}
          rowKey={(record) => (record as any).id || record.filename}
          scroll={{ x: 'max-content' }}
          loading={loading} // 移除 taskStatus === 'running'，避免流式加载时一直显示加载中遮罩
          pagination={isServerMode ? {
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          } : {
            defaultPageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100', '200'],
            showTotal: (total) => `共 ${total} 条`,
          }}
          onChange={handleTableChange}
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
                description={taskStatus === 'running' ? "正在检测中..." : "暂无数据"}
              />
            ),
          }}
        />
      </div>
    </div>
  );
};
