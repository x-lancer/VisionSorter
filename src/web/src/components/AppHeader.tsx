import React from 'react';
import { Layout, Typography, Dropdown } from 'antd';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { TaskType } from '../types';

const { Header } = Layout;
const { Text } = Typography;

interface AppHeaderProps {
  isDark: boolean;
  onToggleDark: () => void;
  onCreateTask: (type: TaskType) => void;
  onOpenTaskPanel: () => void;
  onOpenSystemParams: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isDark,
  onToggleDark,
  onCreateTask,
  onOpenTaskPanel,
  onOpenSystemParams,
}) => {
  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 48,
        lineHeight: '48px',
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
              onCreateTask(key as TaskType);
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
        <div
          onClick={onOpenTaskPanel}
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
          任务面板
        </div>
        <span
          style={{
            color: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)',
            fontSize: 13,
            margin: '0 8px',
          }}
        >
          |
        </span>
        <div
          onClick={onOpenSystemParams}
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
          系统参数
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto' }}>
        <div
          onClick={onToggleDark}
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
        <Text style={{ color: '#9ca3af', fontSize: 12 }}>版本号 v1.0.1</Text>
      </div>
    </Header>
  );
};
