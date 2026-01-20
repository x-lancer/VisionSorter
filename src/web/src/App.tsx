import React, { useState } from 'react';
import { Layout, Typography, Row, Col, Tabs, Card, Dropdown, ConfigProvider, Switch, theme } from 'antd';
import ParameterConfig from './components/ParameterConfig';
import LoadingSpinner from './components/LoadingSpinner';
import ResultStatistics from './components/ResultStatistics';
import ImageList from './components/ImageList';
import ClusterTabs from './components/ClusterTabs';
import ResultPlaceholder from './components/ResultPlaceholder';
import { useCluster } from './hooks/useCluster';
import type { ClusterResult } from './types';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

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

type TaskType = 'cluster' | 'detect';

interface Task {
  id: string;
  name: string;
  type: TaskType;
  createdAt: string;
  params: {
    imageDir: string;
    nClusters: number;
  };
  result?: ClusterResult;
}

const App: React.FC = () => {
  const [imageDir, setImageDir] = useState<string>('');
  const [nClusters, setNClusters] = useState<number>(5);
  const [activeNav, setActiveNav] = useState<'newTask' | 'taskPanel' | 'systemParams'>('newTask');
  const [taskType, setTaskType] = useState<TaskType>('cluster');
  const [activeResultTab, setActiveResultTab] = useState<string>('statistics');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const { loading, handleCluster, saveCurrentResult, saving, result } = useCluster();
  const [isDark, setIsDark] = useState<boolean>(true);

  const activeTask = tasks.find((t) => t.id === activeTaskId) || null;

  const onStart = async () => {
    if (taskType !== 'cluster') {
      return;
    }
    const res = await handleCluster(imageDir, nClusters);
    if (res) {
      const id = `${Date.now()}`;
      const name = `聚类任务-${tasks.length + 1}`;
      const createdAt = new Date().toLocaleString();
      const newTask: Task = {
        id,
        name,
        type: 'cluster',
        createdAt,
        params: { imageDir, nClusters },
        result: res,
      };
      setTasks((prev) => [...prev, newTask]);
      setActiveTaskId(id);
      setActiveNav('taskPanel');
    }
  };

  const handleClusterSelectFromStatistics = (clusterId: number) => {
    setActiveResultTab('clusters');
    setActiveClusterId(String(clusterId));
  };

  return (
    <>
      <style>{globalStyle}</style>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        }}
      >
      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'cluster', label: '聚类任务' },
                  { key: 'detect', label: '检测任务' },
                ],
                onClick: ({ key }) => {
                  setActiveNav('newTask');
                  setTaskType(key as TaskType);
                },
              }}
            >
              <div
                style={{
                  padding: '0 14px',
                  height: 30,
                  lineHeight: '30px',
                  borderRadius: 4,
                  border: '1px solid #444b57',
                  color: '#e5e7eb',
                  fontSize: 13,
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: '#303540',
                }}
              >
                新建任务
              </div>
            </Dropdown>
            {[
              { key: 'taskPanel' as const, label: '任务面板' },
              { key: 'systemParams' as const, label: '系统参数' },
            ].map((item) => {
              const isActive = activeNav === item.key;
              return (
                <div
                  key={item.key}
                  onClick={() => setActiveNav(item.key)}
                  style={{
                    padding: '0 12px',
                    height: 32,
                    lineHeight: '32px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: isActive ? '#f5f5f5' : '#c4c4c4',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    borderBottom: isActive ? '2px solid #1890ff' : '2px solid transparent',
                    backgroundColor: isActive ? '#343a45' : 'transparent',
                    transition: 'all 0.15s ease',
                    marginRight: 4,
                  }}
                >
                  {item.label}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>明亮</Text>
              <Switch
                size="small"
                checked={isDark}
                onChange={(checked) => setIsDark(checked)}
              />
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>暗黑</Text>
            </div>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>版本号 v1.0.0</Text>
          </div>
        </Header>
        <Content style={{ padding: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <Sider
            width={64}
            style={{
              borderRight: '1px solid rgba(5,5,5,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 8,
              rowGap: 8,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                textAlign: 'center',
                cursor: 'default',
                lineHeight: 1.2,
              }}
            >
              任务
              列表
            </div>
          </Sider>
          <div
            style={{
              flex: 1,
              padding: '16px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
          {activeNav === 'newTask' && (
            <div style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
              {[
                { key: 'cluster' as const, label: '聚类任务' },
                { key: 'detect' as const, label: '检测任务' },
              ].map((item) => {
                const isActive = taskType === item.key;
                return (
                  <div
                    key={item.key}
                    onClick={() => setTaskType(item.key)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: isActive ? '#1890ff' : '#595959',
                      backgroundColor: isActive ? '#e6f4ff' : 'transparent',
                      border: isActive ? '1px solid #91caff' : '1px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {item.label}
                  </div>
                );
              })}
            </div>
          )}
          {activeNav === 'newTask' && (
            <Row gutter={24} style={{ width: '100%', height: '100%', display: 'flex' }}>
              {/* 左侧：参数设置卡片（固定宽度） */}
              {taskType === 'cluster' && (
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
              )}

              {/* 右侧：结果显示区域 */}
              <Col span={taskType === 'cluster' ? 18 : 24} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {taskType === 'cluster' && (
                  <>
                    {loading && <LoadingSpinner />}

                    {!loading && !result && <ResultPlaceholder />}

                    {result && !loading && (
                      <Card
                        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                        styles={{
                          body: {
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: 0,
                            minHeight: 0,
                            position: 'relative',
                          },
                        }}
                      >
                        <Tabs
                          activeKey={activeResultTab}
                          onChange={setActiveResultTab}
                          items={[
                            {
                              key: 'statistics',
                              label: '结果统计',
                              children: (
                                <div style={{ padding: '24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                                  <ResultStatistics
                                    result={result}
                                    onClusterSelect={handleClusterSelectFromStatistics}
                                  />
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
                                  <ClusterTabs
                                    clusters={result.clusters}
                                    activeClusterId={activeClusterId || undefined}
                                    onActiveClusterChange={(id) => setActiveClusterId(id)}
                                  />
                                </div>
                              ),
                            },
                          ]}
                          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                          tabBarStyle={{ margin: 0, padding: '0 24px' }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            right: 24,
                            bottom: 16,
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <button
                            onClick={saveCurrentResult}
                            disabled={saving}
                            style={{
                              padding: '6px 16px',
                              fontSize: 12,
                              borderRadius: 4,
                              border: '1px solid #1890ff',
                              backgroundColor: saving ? '#f5f5f5' : '#1890ff',
                              color: saving ? '#999' : '#fff',
                              cursor: saving ? 'not-allowed' : 'pointer',
                              minWidth: 96,
                            }}
                          >
                            {saving ? '保存中...' : '保存结果'}
                          </button>
                        </div>
                      </Card>
                    )}
                  </>
                )}

                {taskType === 'detect' && (
                  <Card
                    style={{
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text type="secondary">检测任务功能建设中...</Text>
                  </Card>
                )}
              </Col>
            </Row>
          )}

          {activeNav === 'taskPanel' && (
            <>
              {tasks.length === 0 ? (
                <Card
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text type="secondary">暂无任务，请通过顶部“新建任务”创建聚类或检测任务。</Text>
                </Card>
              ) : (
                <Tabs
                  type="card"
                  activeKey={activeTaskId || tasks[0]?.id}
                  onChange={(key) => setActiveTaskId(key)}
                  items={tasks.map((task) => ({
                    key: task.id,
                    label: task.name,
                    children:
                      task.type === 'cluster' && task.result ? (
                        <Card
                          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                          styles={{
                            body: {
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              padding: 0,
                              minHeight: 0,
                              position: 'relative',
                            },
                          }}
                        >
                          <Tabs
                            activeKey={activeResultTab}
                            onChange={setActiveResultTab}
                            items={[
                              {
                                key: 'statistics',
                                label: '结果统计',
                                children: (
                                  <div
                                    style={{
                                      padding: '24px',
                                      overflowY: 'auto',
                                      flex: 1,
                                      minHeight: 0,
                                    }}
                                  >
                                    <ResultStatistics
                                      result={task.result}
                                      onClusterSelect={handleClusterSelectFromStatistics}
                                    />
                                  </div>
                                ),
                              },
                              {
                                key: 'images',
                                label: '图片列表',
                                children: (
                                  <div
                                    style={{
                                      padding: '24px',
                                      height: '100%',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <ImageList images={task.result.images} />
                                  </div>
                                ),
                              },
                              {
                                key: 'clusters',
                                label: '分类详情',
                                children: (
                                  <div
                                    style={{
                                      padding: '24px',
                                      overflowY: 'auto',
                                      flex: 1,
                                      minHeight: 0,
                                    }}
                                  >
                                    <ClusterTabs
                                      clusters={task.result.clusters}
                                      activeClusterId={activeClusterId || undefined}
                                      onActiveClusterChange={(id) => setActiveClusterId(id)}
                                    />
                                  </div>
                                ),
                              },
                            ]}
                            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                            tabBarStyle={{ margin: 0, padding: '0 24px' }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              right: 24,
                              bottom: 16,
                              display: 'flex',
                              justifyContent: 'flex-end',
                            }}
                          >
                            <button
                              onClick={saveCurrentResult}
                              disabled={saving}
                              style={{
                                padding: '6px 16px',
                                fontSize: 12,
                                borderRadius: 4,
                                border: '1px solid #1890ff',
                                backgroundColor: saving ? '#f5f5f5' : '#1890ff',
                                color: saving ? '#999' : '#fff',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                minWidth: 96,
                              }}
                            >
                              {saving ? '保存中...' : '保存结果'}
                            </button>
                          </div>
                        </Card>
                      ) : (
                        <Card
                          style={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text type="secondary">检测任务详情展示功能建设中...</Text>
                        </Card>
                      ),
                  }))}
                  style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
                />
              )}
            </>
          )}

          {activeNav === 'systemParams' && (
            <Card
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text type="secondary">系统参数配置功能建设中...</Text>
            </Card>
          )}
          </div>
        </Content>
      </Layout>
      </ConfigProvider>
    </>
  );
};

export default App;

