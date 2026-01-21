import React, { useMemo, useState } from 'react';
import { Row, Col, List, Tag, Space, Typography, Card } from 'antd';
import StatisticCard from './StatisticCard';
import { ClusterResult } from '../types';

const { Text, Title } = Typography;

interface ResultStatisticsProps {
  result: ClusterResult;
  onClusterSelect?: (clusterId: number) => void;
}

// 将 Lab 转为近似 sRGB 颜色，用于前端展示色块
const labToRgb = (L: number, a: number, b: number): string => {
  // 参考 CIE Lab -> XYZ -> sRGB 简化实现，仅用于可视化
  const y = (L + 16) / 116;
  const x = a / 500 + y;
  const z = y - b / 200;

  const pivot = (t: number) => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };

  const X = 95.047 * pivot(x);
  const Y = 100.0 * pivot(y);
  const Z = 108.883 * pivot(z);

  const xyzToRgb = (c: number) => {
    c /= 100;
    let r = c;
    if (c === X / 100) {
      r = c * 3.2406 + (Y / 100) * -1.5372 + (Z / 100) * -0.4986;
    }
    return r;
  };

  let r = X * 0.032406 + Y * -0.015372 + Z * -0.004986;
  let g = X * -0.009689 + Y * 0.018758 + Z * 0.000415;
  let bl = X * 0.000557 + Y * -0.002040 + Z * 0.010570;

  const convert = (c: number) => {
    c = Math.max(0, Math.min(1, c));
    return c <= 0.0031308
      ? 12.92 * c
      : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  r = convert(r);
  g = convert(g);
  bl = convert(bl);

  const to255 = (c: number) => Math.round(c * 255);

  const rr = to255(r);
  const gg = to255(g);
  const bb = to255(bl);

  return `rgb(${rr}, ${gg}, ${bb})`;
};

const ResultStatistics: React.FC<ResultStatisticsProps> = ({ result, onClusterSelect }) => {
  const clusters = useMemo(
    () => Object.values(result.clusters).sort((a, b) => a.cluster_id - b.cluster_id),
    [result.clusters],
  );
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <div>
      <Row gutter={16}>
        <Col span={6}>
          <StatisticCard
            title="总图片数"
            value={result.total_images}
            color="#1890ff"
          />
        </Col>
        <Col span={6}>
          <StatisticCard
            title="聚类数量"
            value={result.n_clusters}
            color="#52c41a"
          />
        </Col>
        <Col span={6}>
          <StatisticCard
            title="类间平均ΔE2000"
            value={result.inter_cluster_stats.mean.toFixed(2)}
            color="#faad14"
          />
        </Col>
        <Col span={6}>
          <StatisticCard
            title="类间最小ΔE2000"
            value={result.inter_cluster_stats.min.toFixed(2)}
            color="#f5222d"
          />
        </Col>
      </Row>
      <Card
        style={{ marginTop: 24 }}
        bodyStyle={{ padding: 16 }}
        title="分类预览"
      >
        <Text type="secondary">点击可跳转查看对应分类详情</Text>
        <List
          style={{ marginTop: 16 }}
          dataSource={clusters}
          rowKey={(item) => String(item.cluster_id)}
          renderItem={(cluster) => {
            const [L, a, b] = cluster.lab_mean || [0, 0, 0];
            const color = labToRgb(L, a, b);
            const displayId = cluster.cluster_id + 1;

            return (
              <List.Item
                style={{
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor:
                    hoveredId === cluster.cluster_id ? '#f5f5f5' : 'transparent',
                  transition: 'background-color 0.2s ease',
                }}
                onClick={() => onClusterSelect?.(cluster.cluster_id)}
                onMouseEnter={() => setHoveredId(cluster.cluster_id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Tag color="blue">类别 {displayId}</Tag>
                    <Text>
                      L: {L.toFixed(2)} / a: {a.toFixed(2)} / b: {b.toFixed(2)}
                    </Text>
                    <Text type="secondary">（{cluster.count} 张）</Text>
                  </Space>
                  <Space>
                    <Text type="secondary">代表色：</Text>
                    <div
                      style={{
                        width: 32,
                        height: 18,
                        borderRadius: 4,
                        border: '1px solid #ddd',
                        backgroundColor: color,
                      }}
                    />
                  </Space>
                </Space>
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
};

export default ResultStatistics;
