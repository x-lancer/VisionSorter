import React from 'react';
import { Typography, Progress, Table } from 'antd';
import { DetectionResult, ClusterResult } from '../types';
import { labToRgbColor } from '../utils/colorUtils';

const { Text } = Typography;

interface DetectionOverviewProps {
  taskStatus: string;
  detectionResults: DetectionResult[];
  detectionTotal: number;
  clusterResult: ClusterResult;
  currentResult: DetectionResult | null;
}

export const DetectionOverview: React.FC<DetectionOverviewProps> = ({
  taskStatus,
  detectionResults,
  detectionTotal,
  clusterResult,
  currentResult,
}) => {
  const progressPercent =
    detectionTotal > 0
      ? Math.round((detectionResults.length / detectionTotal) * 100)
      : 0;

  const validTimes = detectionResults
    .map(r => r.elapsed_time)
    .filter((t): t is number => t !== undefined);
  const avgTime = validTimes.length > 0
    ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length)
    : 0;
  const maxTime = validTimes.length > 0
    ? Math.max(...validTimes)
    : 0;

  return (
    <div
      style={{
        padding: '20px 32px 24px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* 顶部进度条 */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          <span>
            当前进度：已检测 {detectionResults.length} / {detectionTotal || '—'} 张
          </span>
          <span>
            {taskStatus === 'running'
              ? '检测进行中...'
              : detectionResults.length > 0
              ? '检测已完成'
              : '等待开始检测'}
          </span>
        </div>
        <Progress
          percent={progressPercent}
          size="small"
          status={
            taskStatus === 'error'
              ? 'exception'
              : taskStatus === 'completed'
              ? 'success'
              : 'active'
          }
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          gap: 24,
          alignItems: 'flex-start',
        }}
      >
        {/* 左侧：两个圆形展示区 */}
        <div style={{ display: 'flex', gap: 60 }}>
        {/* 左侧：被检测对象 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
            被检测对象
          </div>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '1px solid #d1d5db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
              backgroundColor:
                currentResult && currentResult.lab
                  ? labToRgbColor(
                      currentResult.lab.L,
                      currentResult.lab.a,
                      currentResult.lab.b,
                    )
                  : 'transparent',
            }}
          >
            {currentResult ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {currentResult.filename || '新样本'}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                新样本预览
              </Text>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#4b5563',
              minHeight: 54,
              lineHeight: '18px',
            }}
          >
            {currentResult && currentResult.lab ? (
              <>
                <div>L {currentResult.lab.L.toFixed(1)}</div>
                <div>a {currentResult.lab.a.toFixed(1)}，b {currentResult.lab.b.toFixed(1)}</div>
              </>
            ) : (
              <span style={{ color: '#9ca3af' }}>Lab 等待计算</span>
            )}
          </div>
        </div>

        {/* 右侧：命中的类别 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 8, fontSize: 12, color: '#6b7280' }}>
            命中的类别
          </div>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              border: '1px solid #d1d5db',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 6,
              backgroundColor:
                currentResult && currentResult.matched_cluster_id !== null
                  ? (() => {
                      const clusterId = currentResult.matched_cluster_id!;
                      const cluster =
                        clusterResult?.clusters?.[String(clusterId)] || null;
                      return cluster && cluster.lab_mean
                        ? labToRgbColor(
                            cluster.lab_mean[0],
                            cluster.lab_mean[1],
                            cluster.lab_mean[2],
                          )
                        : 'transparent';
                    })()
                  : 'transparent',
            }}
          >
            {currentResult && currentResult.matched_cluster_id !== null ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                #{currentResult.matched_cluster_id}
              </Text>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                未归类
              </Text>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: '#4b5563',
              minHeight: 54,
              lineHeight: '18px',
            }}
          >
            {currentResult && currentResult.matched_cluster_id !== null ? (
              (() => {
                const clusterId = currentResult.matched_cluster_id!;
                const cluster =
                  clusterResult?.clusters?.[String(clusterId)] || null;
                return cluster && cluster.lab_mean ? (
                  <>
                    <div>L {cluster.lab_mean[0].toFixed(1)}</div>
                    <div>
                      a {cluster.lab_mean[1].toFixed(1)}，b{' '}
                      {cluster.lab_mean[2].toFixed(1)}
                    </div>
                  </>
                ) : (
                  <span style={{ color: '#9ca3af' }}>分类 Lab 未知</span>
                );
              })()
            ) : (
              <span style={{ color: '#9ca3af' }}>尚未命中类别</span>
            )}
          </div>
        </div>

        </div>

        {/* 右侧：统计表格 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {detectionResults.length > 0 && (
          <Table
            size="small"
            pagination={false}
            showHeader={true}
            dataSource={[
              { key: '1', property: '检测平均耗时', value: `${avgTime} ms` },
              { key: '2', property: '检测最大耗时', value: `${maxTime} ms` },
            ]}
            columns={[
              {
                title: '属性',
                dataIndex: 'property',
                key: 'property',
                width: 120,
              },
              {
                title: '数值',
                dataIndex: 'value',
                key: 'value',
                width: 100,
              },
            ]}
            style={{ width: 220 }}
          />
        )}
        </div>
      </div>
    </div>
  );
};
