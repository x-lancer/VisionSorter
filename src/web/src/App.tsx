import React, { useState } from 'react';
import { Layout, Typography, Row, Col, Tabs, Card, Dropdown, ConfigProvider, theme, Input } from 'antd';
import {
  MoonOutlined,
  SunOutlined,
  LeftOutlined,
  RightOutlined,
  UnorderedListOutlined,
  SettingOutlined,
} from '@ant-design/icons';
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
  .ant-tabs-card > .ant-tabs-nav {
    margin-bottom: 0;
  }
  .ant-tabs-card > .ant-tabs-content-holder {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
  .ant-tabs-card.ant-tabs-top > .ant-tabs-content-holder {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
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
  const [activeNav, setActiveNav] = useState<'taskPanel' | 'systemParams'>('taskPanel');
  const [activeResultTab, setActiveResultTab] = useState<string>('statistics');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const { loading, handleCluster, saveCurrentResult, saving } = useCluster();
  const [isDark, setIsDark] = useState<boolean>(false);
  const [siderCollapsed, setSiderCollapsed] = useState<boolean>(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');

  const onStart = async () => {
    if (!activeTaskId) return;
    const activeTask = tasks.find((t) => t.id === activeTaskId);
    if (!activeTask || activeTask.type !== 'cluster') return;

    const res = await handleCluster(activeTask.params.imageDir, activeTask.params.nClusters);
    if (res) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeTaskId
            ? { ...t, result: res }
            : t,
        ),
      );
    }
  };

  const handleClusterSelectFromStatistics = (clusterId: number) => {
    setActiveResultTab('clusters');
    setActiveClusterId(String(clusterId));
  };

  const handleTabEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'remove') {
      const taskId = typeof targetKey === 'string' ? targetKey : (targetKey as any).target?.closest('.ant-tabs-tab')?.dataset?.tabKey;
      if (!taskId) return;
      const newTasks = tasks.filter((task) => task.id !== taskId);
      setTasks(newTasks);
      if (activeTaskId === taskId) {
        setActiveTaskId(newTasks.length > 0 ? newTasks[0].id : null);
      }
    }
  };

  const handleTabDoubleClick = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      setEditingTaskId(taskId);
      setEditingTaskName(task.name);
    }
  };

  const handleTaskNameChange = (taskId: string, newName: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, name: newName } : task))
    );
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleTaskNameBlur = (taskId: string) => {
    if (editingTaskName.trim()) {
      handleTaskNameChange(taskId, editingTaskName.trim());
    } else {
      setEditingTaskId(null);
      setEditingTaskName('');
    }
  };

  const handleTaskNameKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter') {
      if (editingTaskName.trim()) {
        handleTaskNameChange(taskId, editingTaskName.trim());
      }
    } else if (e.key === 'Escape') {
      setEditingTaskId(null);
      setEditingTaskName('');
    }
  };

  return (
    <>
      <style>{globalStyle}</style>
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          components: {
            Layout: {
              headerBg: isDark ? '#001529' : '#ffffff',
              headerColor: isDark ? '#f9fafb' : '#111827',
              bodyBg: isDark ? '#020617' : '#f5f5f5',
              siderBg: isDark ? '#020617' : '#ffffff',
            },
          },
        }}
      >
      <Layout
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'cluster', label: '聚类任务' },
                  { key: 'detect', label: '检测任务' },
                ],
                onClick: ({ key }) => {
                  if (key === 'cluster') {
                    const id = `${Date.now()}`;
                    const name = `聚类任务-${tasks.length + 1}`;
                    const createdAt = new Date().toLocaleString();
                    const newTask: Task = {
                      id,
                      name,
                      type: 'cluster',
                      createdAt,
                      params: { imageDir: '', nClusters: 5 },
                    };
                    setTasks((prev) => [...prev, newTask]);
                    setActiveTaskId(id);
                    setActiveNav('taskPanel');
                  } else if (key === 'detect') {
                    const id = `${Date.now()}`;
                    const name = `检测任务-${tasks.length + 1}`;
                    const createdAt = new Date().toLocaleString();
                    const newTask: Task = {
                      id,
                      name,
                      type: 'detect',
                      createdAt,
                      params: { imageDir: '', nClusters: 5 },
                    };
                    setTasks((prev) => [...prev, newTask]);
                    setActiveTaskId(id);
                    setActiveNav('taskPanel');
                  }
                },
              }}
            >
              <div
                style={{
                  padding: '0 14px',
                  height: 30,
                  lineHeight: '30px',
                  color: isDark ? '#e5e7eb' : '#111827',
                  fontSize: 13,
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                新建任务
              </div>
            </Dropdown>
            <span
              style={{
                color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                fontSize: 13,
                margin: '0 8px',
              }}
            >
              |
            </span>
            {[
              { key: 'taskPanel' as const, label: '任务面板' },
              { key: 'systemParams' as const, label: '系统参数' },
            ].map((item, index) => (
              <React.Fragment key={item.key}>
                {index > 0 && (
                  <span
                    style={{
                      color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
                      fontSize: 13,
                      margin: '0 8px',
                    }}
                  >
                    |
                  </span>
                )}
                <div
                  onClick={() => setActiveNav(item.key)}
                  style={{
                    padding: '0 12px',
                    height: 32,
                    lineHeight: '32px',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    color: '#4b5563',
                    fontSize: 13,
                    fontWeight: 500,
                    backgroundColor: 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {item.label}
                </div>
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
            <div
              onClick={() => setIsDark((prev) => !prev)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 23, 42, 0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              {isDark ? (
                <MoonOutlined style={{ fontSize: 16, color: '#e5e7eb' }} />
              ) : (
                <SunOutlined style={{ fontSize: 16, color: '#f59e0b' }} />
              )}
            </div>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>版本号 v1.0.0</Text>
          </div>
        </Header>
        <Layout style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <Sider
            width={180}
            collapsedWidth={56}
            collapsible
            collapsed={siderCollapsed}
            trigger={null}
            style={{
              borderRight: '1px solid rgba(5,5,5,0.06)',
              display: 'flex',
              flexDirection: 'column',
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: siderCollapsed ? 4 : 8,
              paddingRight: siderCollapsed ? 4 : 8,
              rowGap: 8,
            }}
          >
            {[
              {
                key: 'taskPanel' as const,
                label: '任务列表',
                icon: <UnorderedListOutlined />,
              },
              {
                key: 'systemParams' as const,
                label: '系统参数',
                icon: <SettingOutlined />,
              },
            ].map((item) => (
              <div
                key={item.key}
                onClick={() => setActiveNav(item.key)}
                style={{
                  height: 40,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: siderCollapsed ? 'center' : 'flex-start',
                  padding: siderCollapsed ? '0 4px' : '0 12px',
                  gap: siderCollapsed ? 0 : 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#4b5563',
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 16 }}>
                  {item.icon}
                </span>
                {!siderCollapsed && <span>{item.label}</span>}
              </div>
            ))}
            <div style={{ flex: 1 }} />
            <div
              onClick={() => setSiderCollapsed((prev) => !prev)}
              style={{
                height: 32,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                marginTop: 8,
                color: isDark ? '#e5e7eb' : '#4b5563',
                backgroundColor: isDark ? 'rgba(15,23,42,0.55)' : 'rgba(148,163,184,0.18)',
                transition: 'all 0.15s ease',
              }}
            >
              {siderCollapsed ? <RightOutlined /> : <LeftOutlined />}
            </div>
          </Sider>
          <Content
            style={{
              padding: '16px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
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
                  <Text type="secondary">暂无任务，请通过顶部“新建任务”进行创建。</Text>
                </Card>
              ) : (
                <Tabs
                  type="editable-card"
                  activeKey={activeTaskId || tasks[0]?.id}
                  onChange={(key) => setActiveTaskId(key)}
                  onEdit={handleTabEdit}
                  items={tasks.map((task) => ({
                    key: task.id,
                    label: editingTaskId === task.id ? (
                      <Input
                        value={editingTaskName}
                        onChange={(e) => setEditingTaskName(e.target.value)}
                        onBlur={() => handleTaskNameBlur(task.id)}
                        onKeyDown={(e) => handleTaskNameKeyDown(e, task.id)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        size="small"
                        style={{ width: 120 }}
                      />
                    ) : (
                      <span onDoubleClick={() => handleTabDoubleClick(task.id)}>{task.name}</span>
                    ),
                    children:
                      task.type === 'cluster' ? (
                        task.result ? (
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
                          <Row gutter={24} style={{ width: '100%', height: '100%', display: 'flex' }}>
                            <Col span={6} style={{ display: 'flex', flexDirection: 'column' }}>
                              <ParameterConfig
                                imageDir={task.params.imageDir}
                                nClusters={task.params.nClusters}
                                loading={loading && activeTaskId === task.id}
                                onImageDirChange={(value) => {
                                  setTasks((prev) =>
                                    prev.map((t) =>
                                      t.id === task.id ? { ...t, params: { ...t.params, imageDir: value } } : t,
                                    ),
                                  );
                                }}
                                onNClustersChange={(value) => {
                                  setTasks((prev) =>
                                    prev.map((t) =>
                                      t.id === task.id ? { ...t, params: { ...t.params, nClusters: value } } : t,
                                    ),
                                  );
                                }}
                                onStart={onStart}
                              />
                            </Col>
                            <Col
                              span={18}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                height: '100%',
                                minHeight: 0,
                              }}
                            >
                              {loading && activeTaskId === task.id ? <LoadingSpinner /> : <ResultPlaceholder />}
                            </Col>
                          </Row>
                        )
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
                  tabBarStyle={{ marginBottom: 0 }}
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
          </Content>
        </Layout>
      </Layout>
      </ConfigProvider>
    </>
  );
};

export default App;

