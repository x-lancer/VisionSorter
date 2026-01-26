import React from 'react';
import { Card, Input, Button, Space, Typography } from 'antd';
import { FolderOpenOutlined, LeftOutlined, PlayCircleOutlined, RightOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ParameterConfigProps {
  imageDir: string;
  nClusters: number;
  loading: boolean;
  onImageDirChange: (value: string) => void;
  onNClustersChange: (value: number) => void;
  onStart: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const ParameterConfig: React.FC<ParameterConfigProps> = ({
  imageDir,
  nClusters,
  loading,
  onImageDirChange,
  onNClustersChange,
  onStart,
  collapsed = false,
  onToggleCollapse,
}) => {
  const handleToggleCollapse = () => {
    onToggleCollapse?.();
  };

  return (
    <Card
      title={
        collapsed ? null : (
          <div
            onClick={handleToggleCollapse}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: onToggleCollapse ? 'pointer' : 'default',
              userSelect: 'none',
            }}
          >
            <span>聚类参数设置</span>
            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
              {collapsed ? <RightOutlined /> : <LeftOutlined />}
            </span>
          </div>
        )
      }
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: collapsed && onToggleCollapse ? 'pointer' : undefined,
      }}
      styles={{
        header: {
          cursor: !collapsed && onToggleCollapse ? 'pointer' : undefined,
        },
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          cursor: collapsed && onToggleCollapse ? 'pointer' : undefined,
        },
      }}
      onClick={collapsed ? handleToggleCollapse : undefined}
    >
      {/* 收起态的提示（同时保留内容 DOM，便于做过渡动画） */}
      <div
        style={{
          flex: collapsed ? 1 : 0,
          display: collapsed ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onToggleCollapse ? 'pointer' : 'default',
          userSelect: 'none',
          color: '#6b7280',
          transition: 'opacity 180ms ease',
          opacity: collapsed ? 1 : 0,
        }}
      >
        <RightOutlined />
      </div>

      <div
        style={{
          overflow: 'hidden',
          transition: 'max-height 220ms ease, opacity 180ms ease',
          maxHeight: collapsed ? 0 : 600,
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}
      >
        <Space orientation="vertical" style={{ width: '100%', fontSize: 12 }} size="middle">
          <div>
            <Text strong style={{ fontSize: 12 }}>图片目录路径：</Text>
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
            <Text strong style={{ fontSize: 12 }}>聚类数量 (n)：</Text>
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
            size="middle"
            block
          >
            {loading ? '处理中...' : '开始聚类'}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default ParameterConfig;
