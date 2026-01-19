import React from 'react';
import { Card, Typography } from 'antd';

const { Text } = Typography;

interface StatisticCardProps {
  title: string;
  value: string | number;
  color: string;
}

const StatisticCard: React.FC<StatisticCardProps> = ({ title, value, color }) => (
  <Card>
    <div style={{ textAlign: 'center' }}>
      <Text type="secondary" style={{ fontSize: '14px' }}>
        {title}
      </Text>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color, marginTop: '8px' }}>
        {value}
      </div>
    </div>
  </Card>
);

export default StatisticCard;

