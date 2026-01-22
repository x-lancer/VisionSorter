import React from 'react';
import { Layout } from 'antd';
import { LeftOutlined, RightOutlined, UnorderedListOutlined, SettingOutlined } from '@ant-design/icons';

const { Sider } = Layout;

interface AppSiderProps {
  isDark: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenTaskPanel: () => void;
  onOpenSystemParams: () => void;
}

export const AppSider: React.FC<AppSiderProps> = ({
  isDark,
  collapsed,
  onToggleCollapse,
  onOpenTaskPanel,
  onOpenSystemParams,
}) => {
  return (
    <Sider
      width={180}
      collapsedWidth={56}
      collapsible
      collapsed={collapsed}
      trigger={null}
      style={{
        borderRight: '1px solid rgba(5,5,5,0.06)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: collapsed ? 4 : 8,
        paddingRight: collapsed ? 4 : 8,
        rowGap: 8,
      }}
    >
      {[
        { key: 'taskPanel', label: '任务面板', icon: <UnorderedListOutlined />, onClick: onOpenTaskPanel },
        { key: 'systemParams', label: '系统参数', icon: <SettingOutlined />, onClick: onOpenSystemParams },
      ].map((item) => (
        <div
          key={item.key}
          onClick={item.onClick}
          style={{
            height: 40,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0 4px' : '0 12px',
            gap: collapsed ? 0 : 8,
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
          {!collapsed && <span>{item.label}</span>}
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <div
        onClick={onToggleCollapse}
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
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </div>
    </Sider>
  );
};
