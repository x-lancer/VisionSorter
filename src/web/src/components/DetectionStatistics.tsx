import React, { useMemo } from 'react';
import { Card, Typography, Empty } from 'antd';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { DetectionResult, ClusterResult } from '../types';
import { labToRgbColor } from '../utils/colorUtils';

const { Text, Title } = Typography;

interface DetectionStatisticsProps {
  detectionResults: DetectionResult[];
  clusterResult: ClusterResult;
}

export const DetectionStatistics: React.FC<DetectionStatisticsProps> = ({
  detectionResults,
  clusterResult,
}) => {
  // 计算统计数据
  const statsData = useMemo(() => {
    if (!detectionResults.length || !clusterResult?.clusters) {
      return [];
    }

    const clusterCounts: Record<string, number> = {};
    let unclassifiedCount = 0;

    // 统计每个类别的数量
    detectionResults.forEach((result) => {
      if (result.matched_cluster_id !== null) {
        const clusterId = String(result.matched_cluster_id);
        clusterCounts[clusterId] = (clusterCounts[clusterId] || 0) + 1;
      } else {
        unclassifiedCount++;
      }
    });

    // 转换为图表所需格式
    const data = Object.keys(clusterResult.clusters).map((clusterId) => {
      const cluster = clusterResult.clusters[clusterId];
      const count = clusterCounts[clusterId] || 0;
      const color = labToRgbColor(
        cluster.lab_mean[0],
        cluster.lab_mean[1],
        cluster.lab_mean[2]
      );

      return {
        name: `类别 ${clusterId}`,
        clusterId: Number(clusterId),
        value: count,
        color,
        lab: cluster.lab_mean,
      };
    });

    // 添加未归类项（如果有）
    if (unclassifiedCount > 0) {
      data.push({
        name: '未归类',
        clusterId: -1,
        value: unclassifiedCount,
        color: '#9ca3af', // 灰色
        lab: null,
      });
    }

    // 按数量排序（可选）
    return data.sort((a, b) => b.value - a.value);
  }, [detectionResults, clusterResult]);

  if (detectionResults.length === 0) {
    return <Empty description="暂无检测数据" />;
  }

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percent = ((data.value / detectionResults.length) * 100).toFixed(1);
      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #f0f0f0',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>{data.name}</p>
          <p style={{ margin: '4px 0 0', color: '#666' }}>
            数量: {data.value} ({percent}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
          {/* 饼图：占比分布 */}
          <Card
            title="分类占比分布"
            style={{ flex: '1 1 400px', minWidth: 400 }}
            styles={{ body: { height: 400 } }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ paddingLeft: 20 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* 柱状图：数量对比 */}
          <Card
            title="分类数量统计"
            style={{ flex: '1 1 400px', minWidth: 400 }}
            styles={{ body: { height: 400 } }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statsData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} />
                <YAxis allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* 详细数据摘要 */}
        <Card style={{ marginTop: 24 }}>
          <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
            数据摘要
          </Title>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 120 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>总样本数</Text>
              <div style={{ fontSize: 24, fontWeight: 500 }}>
                {detectionResults.length}
              </div>
            </div>
            <div style={{ minWidth: 120 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>已归类样本</Text>
              <div style={{ fontSize: 24, fontWeight: 500, color: '#52c41a' }}>
                {detectionResults.length -
                  (statsData.find((d) => d.clusterId === -1)?.value || 0)}
              </div>
            </div>
            <div style={{ minWidth: 120 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>未归类样本</Text>
              <div style={{ fontSize: 24, fontWeight: 500, color: '#faad14' }}>
                {statsData.find((d) => d.clusterId === -1)?.value || 0}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
