import React from 'react';
import { Card, Space, Typography, Input, InputNumber, Select, Button, Tabs, theme } from 'antd';
import { Task, ClusterResult } from '../types';
import { labToRgbColor } from '../utils/colorUtils';
import { DetectionOverview } from './DetectionOverview';
import { DetectionList } from './DetectionList';
import { DetectionStatistics } from './DetectionStatistics';

const { Text } = Typography;
const { Search } = Input;

interface DetectionTaskViewProps {
  task: Task;
  savedClusterResults: Array<{
    id: number;
    task_name: string;
    created_at: string;
    clusterResult: ClusterResult;
  }>;
  detectionViewKey: 'overview' | 'list' | 'statistics';
  searchText: string;
  filterClusterId: number | null;
  filterStatus: string | null;
  savingDetectionTaskId: string | null;
  onUpdateTaskParams: (taskId: string, params: Partial<Task['params']>) => void;
  onStartDetection: (taskId: string) => void;
  onCancelDetection: (taskId: string) => void;
  onPauseDetection: (taskId: string) => void;
  onResumeDetection: (taskId: string) => void;
  onSaveDetectionResult: (task: Task) => void;
  onDetectionViewKeyChange: (key: 'overview' | 'list' | 'statistics') => void;
  onSearchTextChange: (value: string) => void;
  onFilterClusterIdChange: (value: number | null) => void;
  onFilterStatusChange: (value: string | null) => void;
}

export const DetectionTaskView: React.FC<DetectionTaskViewProps> = ({
  task,
  savedClusterResults,
  detectionViewKey,
  searchText,
  filterClusterId,
  filterStatus,
  savingDetectionTaskId,
  onUpdateTaskParams,
  onStartDetection,
  onCancelDetection,
  onPauseDetection,
  onResumeDetection,
  onSaveDetectionResult,
  onDetectionViewKeyChange,
  onSearchTextChange,
  onFilterClusterIdChange,
  onFilterStatusChange,
}) => {
  const { token } = theme.useToken();
  const hasClusterResult = task.params.clusterResultId && task.params.clusterResult;
  const hasImageDir = task.params.imageDir.trim();
  const canStartDetection = hasClusterResult && hasImageDir;
  const detectionStarted = task.params.detectionStarted === true;
  const detectionResults = task.params.detectionResults || [];
  const currentResult =
    detectionResults.length > 0
      ? detectionResults[detectionResults.length - 1]
      : null;
  const detectionTotal =
    task.params.detectionTotal && task.params.detectionTotal > 0
      ? task.params.detectionTotal
      : detectionResults.length;

  // 还未开始检测：展示配置页面
  if (!detectionStarted) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          gap: 16,
        }}
      >
        <Card
          style={{
            maxWidth: 600,
            margin: '0 auto',
            marginTop: 40,
          }}
        >
          <Space orientation="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
                选择参考的聚类结果
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                检测任务需要基于已有的聚类结果进行，请先选择一个已保存的聚类结果
              </Text>
            </div>
            <Select
              placeholder="请选择聚类结果"
              style={{ width: '100%' }}
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={savedClusterResults.map((item) => ({
                value: item.id,
                label: `${item.task_name} (${new Date(item.created_at).toLocaleString()})`,
                clusterResult: item.clusterResult,
              }))}
              onChange={(value, option: any) => {
                onUpdateTaskParams(task.id, {
                  clusterResultId: value,
                  clusterResult: option.clusterResult,
                });
              }}
            />
            <div>
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                待检测图片目录
              </Text>
              <Input
                placeholder="请输入待检测图片所在的目录路径"
                size="large"
                value={task.params.imageDir}
                onChange={(e) => {
                  onUpdateTaskParams(task.id, { imageDir: e.target.value });
                }}
              />
            </div>
            <div>
              <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
                距离阈值 (max_scale)
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                允许新样本距离比类内最大距离多出的比例，默认 1.1（即允许多 10%）
              </Text>
              <InputNumber
                placeholder="请输入阈值"
                size="large"
                style={{ width: '100%' }}
                min={0.1}
                max={10}
                step={0.1}
                precision={2}
                value={task.params.maxScale ?? 1.1}
                onChange={(value) => {
                  onUpdateTaskParams(task.id, { maxScale: value ?? 1.1 });
                }}
              />
            </div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Button
                type="primary"
                size="large"
                disabled={!canStartDetection}
                onClick={() => onStartDetection(task.id)}
                style={{ minWidth: 120 }}
              >
                开始检测
              </Button>
            </div>
          </Space>
        </Card>
      </div>
    );
  }

  // 已开始检测：展示检测结果页面
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: token.colorBgContainer,
      }}
    >
      {/* 第一块区域：所有聚类结果的 Lab 胶囊 + 总分类数 + 取消按钮 */}
      <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
        <Card bodyStyle={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
            <div style={{ flex: 1, overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
              {task.params.clusterResult?.clusters ? Object.values(task.params.clusterResult.clusters).map((cluster) => (
                <div
                  key={cluster.cluster_id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 999,
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '999px',
                      backgroundColor: labToRgbColor(
                        cluster.lab_mean[0],
                        cluster.lab_mean[1],
                        cluster.lab_mean[2],
                      ),
                      border: '1px solid rgba(0,0,0,0.06)',
                      marginRight: 6,
                    }}
                  />
                  <span>
                    #{cluster.cluster_id} &nbsp;L
                    {cluster.lab_mean[0].toFixed(1)} a
                    {cluster.lab_mean[1].toFixed(1)} b
                    {cluster.lab_mean[2].toFixed(1)}
                  </span>
                </div>
              )) : (
                <Text type="secondary" style={{ fontSize: 12 }}>无法加载分类信息（可能是旧版本的保存记录）</Text>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>
              总分类数：
              {Object.keys(task.params.clusterResult?.clusters || {}).length}
            </div>
            {task.status === 'running' && (
              <Button
                size="small"
                danger
                onClick={() => onCancelDetection(task.id)}
              >
                取消检测
              </Button>
            )}
          </div>
          </div>
        </Card>
      </div>

      {/* 第二块区域：Card 自带 tab 切换"检测概览 / 检测列表" */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '0 24px 24px' }}>
        <Card
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          bodyStyle={{
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Tabs
          activeKey={detectionViewKey}
          onChange={(key) => onDetectionViewKeyChange(key as 'overview' | 'list' | 'statistics')}
          destroyInactiveTabPane={true}
          animated={false}
          tabBarStyle={{ margin: 0, padding: '0 24px' }}
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          tabBarExtraContent={
            detectionViewKey === 'overview' ? (
              // 检测概览：显示操作按钮
              <Space>
                {task.status === 'running' || task.status === 'paused' ? (
                  <Button
                    size="middle"
                    onClick={() => {
                      if (task.status === 'running') {
                        onPauseDetection(task.id);
                      } else if (task.status === 'paused') {
                        onResumeDetection(task.id);
                      }
                    }}
                  >
                    {task.status === 'running' ? '暂停检测' : '继续检测'}
                  </Button>
                ) : null}
                <Button
                  type="primary"
                  size="middle"
                  disabled={
                    task.status !== 'completed' ||
                    !detectionResults.length ||
                    savingDetectionTaskId === task.id
                  }
                  loading={savingDetectionTaskId === task.id}
                  onClick={() => onSaveDetectionResult(task)}
                >
                  保存结果
                </Button>
              </Space>
            ) : detectionViewKey === 'list' ? (
              // 检测列表：显示搜索和筛选控件
              <Space>
                <Search
                  placeholder="搜索文件名"
                  allowClear
                  style={{ width: 200 }}
                  value={searchText}
                  onChange={(e) => onSearchTextChange(e.target.value)}
                />
                <Select
                  placeholder="筛选分类"
                  allowClear
                  style={{ width: 120 }}
                  value={filterClusterId}
                  onChange={onFilterClusterIdChange}
                >
                  {task.params.clusterResult?.clusters &&
                    Object.keys(task.params.clusterResult.clusters).map((clusterId) => (
                      <Select.Option key={clusterId} value={parseInt(clusterId)}>
                        类别 {clusterId}
                      </Select.Option>
                    ))}
                  <Select.Option value={-1}>未归类</Select.Option>
                </Select>
              </Space>
            ) : null
          }
          items={[
            {
              key: 'overview',
              label: '检测概览',
              children: (
                <div style={{ height: '100%', overflow: 'auto' }}>
                  <DetectionOverview
                    taskStatus={task.status}
                    detectionResults={detectionResults}
                    detectionTotal={detectionTotal}
                    clusterResult={task.params.clusterResult!}
                    currentResult={currentResult}
                  />
                </div>
              ),
            },
            {
              key: 'list',
              label: '检测列表',
              children: (
                <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <DetectionList
                    detectionResults={detectionResults}
                    clusterResult={task.params.clusterResult!}
                    taskStatus={task.status}
                    searchText={searchText}
                    filterClusterId={filterClusterId}
                    onSearchTextChange={onSearchTextChange}
                    onFilterClusterIdChange={onFilterClusterIdChange}
                  />
                </div>
              ),
            },
            {
              key: 'statistics',
              label: '分布统计',
              disabled: task.status !== 'completed',
              children: (
                <div style={{ height: '100%', overflow: 'hidden' }}>
                  <DetectionStatistics
                    detectionResults={detectionResults}
                    clusterResult={task.params.clusterResult!}
                  />
                </div>
              ),
            },
          ]}
        />
        </Card>
      </div>
    </div>
  );
};
