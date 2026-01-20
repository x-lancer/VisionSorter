import React, { useState } from 'react';
import { Layout, Typography, Row, Col, Tabs, Card } from 'antd';
import ParameterConfig from './components/ParameterConfig';
import LoadingSpinner from './components/LoadingSpinner';
import ResultStatistics from './components/ResultStatistics';
import ImageList from './components/ImageList';
import ClusterTabs from './components/ClusterTabs';
import ResultPlaceholder from './components/ResultPlaceholder';
import { useCluster } from './hooks/useCluster';

const { Header, Content } = Layout;
const { Title } = Typography;

// 全局样式：确保页面占满视口高度
const globalStyle = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .ant-tabs-content-holder {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .ant-tabs-content {
    height: 100%;
  }
  .ant-tabs-tabpane {
    height: 100%;
    overflow: hidden;
  }
`;

const App: React.FC = () => {
  const [imageDir, setImageDir] = useState<string>('');
  const [nClusters, setNClusters] = useState<number>(5);
  const [activeResultTab, setActiveResultTab] = useState<string>('statistics');
  const { loading, result, handleCluster } = useCluster();

  const onStart = () => {
    handleCluster(imageDir, nClusters);
  };

  return (
    <>
      <style>{globalStyle}</style>
      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ background: '#001529', padding: '0 24px', flexShrink: 0 }}>
        <Title level={3} style={{ color: 'white', margin: '16px 0' }}>
          基于Lab视觉分类系统
        </Title>
      </Header>
      <Content style={{ padding: '24px', flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Row gutter={24} style={{ width: '100%', height: '100%', display: 'flex' }}>
          {/* 左侧：参数设置卡片（固定宽度） */}
          <Col span={6} style={{ display: 'flex', flexDirection: 'column' }}>
            <ParameterConfig
              imageDir={imageDir}
              nClusters={nClusters}
              loading={loading}
              onImageDirChange={setImageDir}
              onNClustersChange={setNClusters}
              onStart={onStart}
            />
          </Col>

          {/* 右侧：结果显示区域 */}
          <Col span={18} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {loading && <LoadingSpinner />}

            {!loading && !result && <ResultPlaceholder />}

            {result && !loading && (
              <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }} bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minHeight: 0 }}>
                <Tabs
                  activeKey={activeResultTab}
                  onChange={setActiveResultTab}
                  items={[
                    {
                      key: 'statistics',
                      label: '结果统计',
                      children: (
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                          <ResultStatistics result={result} />
                        </div>
                      ),
                    },
                    {
                      key: 'images',
                      label: '图片列表',
                      children: (
                        <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <ImageList images={result.images} />
                        </div>
                      ),
                    },
                    {
                      key: 'clusters',
                      label: '分类详情',
                      children: (
                        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                          <ClusterTabs clusters={result.clusters} />
                        </div>
                      ),
                    },
                  ]}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                  tabBarStyle={{ margin: 0, padding: '0 24px' }}
                />
              </Card>
            )}
          </Col>
        </Row>
      </Content>
    </Layout>
    </>
  );
};

export default App;

