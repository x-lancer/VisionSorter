import React, { useState } from 'react';
import { Card, Space, Typography, Input, InputNumber, Select, Button, Tabs, theme } from 'antd';
import { Task, ClusterResult } from '../types';
import { labToRgbColor } from '../utils/colorUtils';
import { DetectionOverview } from './DetectionOverview';
import { DetectionList } from './DetectionList';
import { DetectionStatistics } from './DetectionStatistics';
import { DetectionClassDetails } from './DetectionClassDetails';
import { useTaskStore } from '../store/useTaskStore';
import { useTasks } from '../hooks/useTasks';

const { Text } = Typography;
const { Search } = Input;

interface DetectionTaskViewProps {
  taskId: string;
}

export const DetectionTaskView: React.FC<DetectionTaskViewProps> = ({
  taskId,
}) => {
  const { token } = theme.useToken();
  
  // 1. 本地 UI 状态
  const [detectionViewKey, setDetectionViewKey] = useState<'overview' | 'list' | 'classes' | 'statistics'>('overview');
  const [searchText, setSearchText] = useState<string>('');
  const [filterClusterId, setFilterClusterId] = useState<number | null>(null);
  
  // 2. 从 Store 获取任务数据
  const task = useTaskStore((state) => state.tasks.find((t) => t.id === taskId));
  const savedClusterResults = useTaskStore((state) => state.savedClusterResults);

  // 3. 获取操作方法
  const { 
    updateTaskParams, 
    onStartDetection, 
    onCancelDetection, 
    onPauseDetection, 
    onResumeDetection, 
    handleSaveDetectionResult,
    savingDetectionTaskId,
    loadTaskDetail, // 引入加载详情方法
    loadClusterResultDetail // 引入加载聚类详情方法
  } = useTasks();

  // 组件挂载时检查是否需要加载详情
  React.useEffect(() => {
    if (!task) return;
    // 如果是已保存的任务，且还没加载过详情（recent_results/statistics/clusterResult），且没有正在加载，则加载详情
    const hasDetail =
      task.params.clusterResult != null ||
      task.params.clusterResultId != null ||
      task.params.statistics != null ||
      (task.params.recentResults?.length ?? 0) > 0;

    if (task.isSaved && !hasDetail && !task.isLoadingDetail) {
      loadTaskDetail(task);
    }
  }, [
    task?.id,
    task?.isSaved,
    task?.isLoadingDetail,
    task?.params.clusterResult,
    task?.params.clusterResultId,
    task?.params.statistics,
    task?.params.recentResults,
    loadTaskDetail,
  ]);

  if (!task) return null;

  const hasClusterResult = task.params.clusterResultId && task.params.clusterResult;
  const hasImageDir = task.params.imageDir.trim();
  const canStartDetection = hasClusterResult && hasImageDir;
  const detectionStarted = task.params.detectionStarted === true;
  const detectionResults = task.params.detectionResults || [];
  const recentResults = task.params.recentResults || [];
  const displayResults = detectionResults.length > 0 ? detectionResults : recentResults;
  
  const currentResult =
    displayResults.length > 0
      ? displayResults[displayResults.length - 1]
      : null;
  const detectionTotal =
    task.params.detectionTotal && task.params.detectionTotal > 0
      ? task.params.detectionTotal
      : detectionResults.length;
  
  const processedCount = task.params.detectionCurrentIndex || detectionResults.length;

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
              onChange={async (value, option: any) => {
                // 如果 option 中没有 clusterResult (懒加载)，则去加载
                let clusterResult = option.clusterResult;
                if (!clusterResult) {
                   const detail = await loadClusterResultDetail(value);
                   if (detail) {
                     clusterResult = detail;
                   }
                }
                
                updateTaskParams(task.id, {
                  clusterResultId: value,
                  clusterResult: clusterResult,
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
                  updateTaskParams(task.id, { imageDir: e.target.value });
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
                  updateTaskParams(task.id, { maxScale: value ?? 1.1 });
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
          onChange={(key) => setDetectionViewKey(key as 'overview' | 'list' | 'classes' | 'statistics')}
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
                  onClick={() => handleSaveDetectionResult(task)}
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
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Select
                  placeholder="筛选分类"
                  allowClear
                  style={{ width: 120 }}
                  value={filterClusterId}
                  onChange={setFilterClusterId}
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
                    processedCount={processedCount}
                    recentResults={displayResults}
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
                    taskId={task.id}
                    taskDbId={task.dbId}
                    isSaved={task.isSaved}
                    // Since DetectionList will now handle fetching in server mode, 
                    // we don't strictly need these change handlers if they are only for client state,
                    // but DetectionList uses them to update parent state for consistency?
                    // Actually, if DetectionList handles server fetching internally,
                    // parent searchText is still used for the input value.
                    // So we keep passing them.
                    onSearchTextChange={setSearchText}
                    onFilterClusterIdChange={setFilterClusterId}
                  />
                </div>
              ),
            },
            {
              key: 'classes',
              label: '分类详情',
              disabled: !task.isSaved || !task.dbId,
              children: (
                <div style={{ height: '100%', overflow: 'hidden' }}>
                  {task.isSaved && task.dbId ? (
                    <DetectionClassDetails
                      taskDbId={task.dbId}
                      clusterResult={task.params.clusterResult}
                      statistics={task.params.statistics}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ marginBottom: 8, fontSize: 14 }}>请先保存检测结果</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          分类详情需要从数据库分页读取图片列表（每页 20 张）
                        </div>
                      </div>
                    </div>
                  )}
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
                    statistics={task.params.statistics}
                    detectionTotal={detectionTotal}
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
