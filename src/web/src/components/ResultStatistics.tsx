import React from 'react';
import { Row, Col } from 'antd';
import StatisticCard from './StatisticCard';
import { ClusterResult } from '../types';

interface ResultStatisticsProps {
  result: ClusterResult;
}

const ResultStatistics: React.FC<ResultStatisticsProps> = ({ result }) => {
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
    </div>
  );
};

export default ResultStatistics;

