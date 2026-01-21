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
      <Text type="secondary" style={{ fontSize: 12 }}>
        {title}
      </Text>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginTop: 8 }}>
        {value}
      </div>
    </div>
  </Card>
);

export default StatisticCard;

