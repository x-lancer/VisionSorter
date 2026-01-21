import React from 'react';
import { Card, Typography, Empty } from 'antd';

const { Text, Title } = Typography;

const ResultPlaceholder: React.FC = () => {
  return (
    <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Empty
        description={
          <div>
            <Title level={5} type="secondary" style={{ marginTop: 0, marginBottom: 8 }}>
              等待聚类结果
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              请在左侧输入图片目录路径和聚类数量，然后点击"开始聚类"按钮。
            </Text>
          </div>
        }
        style={{ padding: '40px 0' }}
      />
    </Card>
  );
};

export default ResultPlaceholder;

