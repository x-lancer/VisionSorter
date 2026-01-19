import React from 'react';
import { Card, Spin, Typography } from 'antd';

const { Text } = Typography;

const LoadingSpinner: React.FC = () => {
  return (
    <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>正在处理图片，请稍候...</Text>
        </div>
      </div>
    </Card>
  );
};

export default LoadingSpinner;

