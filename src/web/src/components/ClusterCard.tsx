import React from 'react';
import { Space, Typography, Row, Col, Divider, Image } from 'antd';
import { ClusterInfo } from '../types';
import { API_BASE_URL } from '../constants';

const { Text } = Typography;

interface ClusterCardProps {
  cluster: ClusterInfo;
}

const ClusterCard: React.FC<ClusterCardProps> = ({ cluster }) => {
  return (
    <div>
      <Row gutter={16}>
        {/* 左侧：统计信息卡片 */}
        <Col span={6}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 基准LAB值 */}
            <div>
              <Divider orientation="left">基准LAB值</Divider>
              <Space orientation="vertical">
                <Text>
                  L: <Text strong>{cluster.lab_mean[0].toFixed(2)}</Text>
                  <Text type="secondary">（±{cluster.lab_std[0].toFixed(2)}）</Text>
                </Text>
                <Text>
                  a: <Text strong>{cluster.lab_mean[1].toFixed(2)}</Text>
                  <Text type="secondary">（±{cluster.lab_std[1].toFixed(2)}）</Text>
                </Text>
                <Text>
                  b: <Text strong>{cluster.lab_mean[2].toFixed(2)}</Text>
                  <Text type="secondary">（±{cluster.lab_std[2].toFixed(2)}）</Text>
                </Text>
              </Space>
            </div>

            {/* 与基准的误差 */}
            <div>
              <Divider orientation="left">与基准的误差</Divider>
              <Space orientation="vertical">
                <Text>
                  平均: <Text strong>{cluster.de2000_mean.toFixed(2)}</Text>
                </Text>
                <Text>
                  最大: <Text strong>{cluster.de2000_max.toFixed(2)}</Text>
                </Text>
                <Text>
                  标准差: <Text strong>{cluster.de2000_std.toFixed(2)}</Text>
                </Text>
              </Space>
            </div>

            {/* 样本间的误差 */}
            <div>
              <Divider orientation="left">样本间的误差</Divider>
              <Space orientation="vertical">
                <Text>
                  平均: <Text strong>{cluster.de2000_intra_mean.toFixed(2)}</Text>
                </Text>
                <Text>
                  最大: <Text strong>{cluster.de2000_intra_max.toFixed(2)}</Text>
                </Text>
              </Space>
            </div>
          </div>
        </Col>

        {/* 右侧：图片列表 */}
        <Col span={18}>
          <div>
            <Divider orientation="left">图片列表 ({cluster.image_paths.length} 张)</Divider>
            <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '8px 0' }}>
              <Space wrap size="small">
                {cluster.image_paths.map((path, idx) => {
                  const imageUrl = `${API_BASE_URL}/api/image?path=${encodeURIComponent(path)}`;
                  const fileName = path.split(/[/\\]/).pop() || '';
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'inline-block',
                        textAlign: 'center',
                        margin: '4px',
                        verticalAlign: 'top',
                      }}
                    >
                      <Image
                        src={imageUrl}
                        alt={fileName}
                        width={100}
                        height={100}
                        style={{
                          objectFit: 'cover',
                          border: '1px solid #d9d9d9',
                          borderRadius: '4px',
                        }}
                        preview={{
                          mask: '预览',
                        }}
                        fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                        onError={() => {
                          console.error('图片加载失败:', path);
                        }}
                      />
                      <div style={{ marginTop: '4px', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Text type="secondary" style={{ fontSize: '11px' }} title={fileName}>
                          {fileName}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </Space>
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default ClusterCard;

