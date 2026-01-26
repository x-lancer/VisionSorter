import React, { useState } from 'react';
import { Table, Tag, Space, Button, Radio, Typography, Popconfirm, Empty } from 'antd';
import { DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;

export type TaskType = 'cluster' | 'detect';
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'error';

export interface Task {
  id: string;
  name: string;
  type: TaskType;
  status: TaskStatus;
  createdAt: string;
  params: {
    imageDir: string;
    nClusters: number;
  };
  result?: any;
  errorMessage?: string;
  isSaved?: boolean;
  dbId?: number;
}

interface TaskListProps {
  tasks: Task[];
  onViewTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
}

const TaskList: React.FC<TaskListProps> = ({ tasks, onViewTask, onDeleteTask }) => {
  const [filterType, setFilterType] = useState<'all' | TaskType>('all');

  const filteredTasks = filterType === 'all' 
    ? tasks 
    : tasks.filter(task => task.type === filterType);

  const formatTime = (value: string) => {
    // 兼容 ISO 字符串（如 2026-01-23T07:21:18Z）以及本地字符串
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const getStatusTag = (status: TaskStatus, isSaved?: boolean) => {
    const statusConfig: Record<TaskStatus, { color: string; text: string }> = {
      pending: { color: 'default', text: '待执行' },
      running: { color: 'processing', text: '进行中' },
      paused: { color: 'warning', text: '已暂停' },
      completed: { color: 'success', text: isSaved ? '已保存' : '已完成' },
      error: { color: 'error', text: '执行出错' },
    };
    const config = statusConfig[status];
    return <Tag color={isSaved ? 'cyan' : config.color}>{config.text}</Tag>;
  };

  const getTypeTag = (type: TaskType) => {
    const typeConfig: Record<TaskType, { color: string; text: string }> = {
      cluster: { color: 'blue', text: '聚类任务' },
      detect: { color: 'purple', text: '检测任务' },
    };
    const config = typeConfig[type];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns: ColumnsType<Task> = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 180,
      render: (id: string) => (
        <Text copyable style={{ fontSize: 12 }}>
          {id}
        </Text>
      ),
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '任务类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: TaskType) => getTypeTag(type),
    },
    {
      title: '任务状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: TaskStatus, record: Task) => getStatusTag(status, record.isSaved),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (value: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatTime(value)}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewTask(record.id)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定删除该任务？"
            onConfirm={() => onDeleteTask(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <Radio.Group
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="all" style={{ width: 100, textAlign: 'center' }}>全部</Radio.Button>
          <Radio.Button value="cluster" style={{ width: 100, textAlign: 'center' }}>聚类任务</Radio.Button>
          <Radio.Button value="detect" style={{ width: 100, textAlign: 'center' }}>检测任务</Radio.Button>
        </Radio.Group>
        <Text type="secondary" style={{ marginLeft: 16 }}>
          共 {filteredTasks.length} 个任务
        </Text>
      </div>
      <Table
        columns={columns}
        dataSource={filteredTasks}
        rowKey="id"
        size="middle"
        pagination={filteredTasks.length > 0 ? {
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
        } : false}
        style={{ flex: 1 }}
        scroll={{ x: 'max-content', ...(filteredTasks.length > 0 ? { y: 'calc(100vh - 320px)' } : {}) }}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />,
        }}
      />
    </div>
  );
};

export default TaskList;
