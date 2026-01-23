import React, { useMemo } from 'react';
import { Tabs, Dropdown, MenuProps } from 'antd';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { DraggableTabNode } from './DraggableTabNode';
import { TabItem, TaskType } from '../types';

interface DraggableTabsProps {
  tabs: TabItem[];
  activeTabKey: string | null;
  onTabsChange: (tabs: TabItem[]) => void;
  onActiveTabChange: (key: string) => void;
  onTabEdit: (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => void;
  onAddClick: (type: TaskType) => void;
  items: NonNullable<React.ComponentProps<typeof Tabs>['items']>;
}

export const DraggableTabs: React.FC<DraggableTabsProps> = ({
  tabs,
  activeTabKey,
  onTabsChange,
  onActiveTabChange,
  onTabEdit,
  onAddClick,
  items,
}) => {
  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 10 } });
  const sensors = useSensors(sensor);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const activeIndex = tabs.findIndex((tab) => tab.key === active.id);
      const overIndex = tabs.findIndex((tab) => tab.key === over.id);
      const newTabs = arrayMove(tabs, activeIndex, overIndex);
      onTabsChange(newTabs);
    }
  };

  const addMenu: MenuProps = {
    items: [
      { key: 'cluster', label: '聚类任务' },
      { key: 'detect', label: '检测任务' },
    ],
    onClick: ({ key }) => onAddClick(key as TaskType),
  };

  return (
    <div className="root-tabs" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>
        {`
          .root-tabs .ant-tabs-nav-add {
            padding: 0 !important;
            min-width: 40px;
          }
          .root-tabs .ant-tabs-nav-add > .ant-dropdown-trigger {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px 15px; /* Re-apply padding internally to maintain visual size if needed, or just center */
          }
        `}
      </style>
      <Tabs
        type="editable-card"
        activeKey={activeTabKey || undefined}
        onChange={onActiveTabChange}
        onEdit={(targetKey, action) => {
          if (action === 'remove') {
            onTabEdit(targetKey, action);
          }
        }}
        destroyInactiveTabPane={true}
        animated={false}
        addIcon={
          <Dropdown trigger={['click']} menu={addMenu}>
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              +
            </div>
          </Dropdown>
        }
        renderTabBar={(tabBarProps, DefaultTabBar) => (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={tabs.map((t) => t.key)} strategy={horizontalListSortingStrategy}>
              <DefaultTabBar {...tabBarProps}>
                {(node) => (
                  <DraggableTabNode key={node.key} data-node-key={node.key as string}>
                    {node}
                  </DraggableTabNode>
                )}
              </DefaultTabBar>
            </SortableContext>
          </DndContext>
        )}
        items={items}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        tabBarStyle={{ marginBottom: 0 }}
      />
    </div>
  );
};
