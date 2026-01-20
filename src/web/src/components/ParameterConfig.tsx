import React from 'react';
import { Card, Input, Button, Space, Typography } from 'antd';
import { FolderOpenOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ParameterConfigProps {
  imageDir: string;
  nClusters: number;
  loading: boolean;
  onImageDirChange: (value: string) => void;
  onNClustersChange: (value: number) => void;
  onStart: () => void;
}

const ParameterConfig: React.FC<ParameterConfigProps> = ({
  imageDir,
  nClusters,
  loading,
  onImageDirChange,
  onNClustersChange,
  onStart,
}) => {
  return (
    <Card
      title="聚类参数设置"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      styles={{
        body: { flex: 1, display: 'flex', flexDirection: 'column' },
      }}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>图片目录路径：</Text>
          <Input
            placeholder="例如：D:\Workspace\VisionSorter\samples\Validation_MIX"
            value={imageDir}
            onChange={(e) => onImageDirChange(e.target.value)}
            prefix={<FolderOpenOutlined />}
            disabled={loading}
            onPressEnter={onStart}
            style={{ marginTop: '8px', width: '100%' }}
          />
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
            请输入图片文件夹的完整路径
          </Text>
        </div>
        <div>
          <Text strong>聚类数量 (n)：</Text>
          <Input
            type="number"
            min={1}
            value={nClusters}
            onChange={(e) => onNClustersChange(parseInt(e.target.value) || 1)}
            style={{ marginTop: '8px', width: '100%' }}
            disabled={loading}
          />
        </div>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onStart}
          loading={loading}
          size="large"
          block
        >
          {loading ? '处理中...' : '开始聚类'}
        </Button>
      </Space>
    </Card>
  );
};

export default ParameterConfig;
