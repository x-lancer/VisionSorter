import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Table, Tag, Input, Space } from 'antd';
import axios from 'axios';
import { ImageInfo } from '../types';
import { API_BASE_URL } from '../constants';

const { Search } = Input;

interface ImageListProps {
  images?: ImageInfo[];
  taskId?: string;
  taskDbId?: number;
  isSaved?: boolean;
}

const ImageList: React.FC<ImageListProps> = ({ images = [], taskId, taskDbId, isSaved }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = useState<number>(400);
  
  // 服务端分页状态
  const [serverImages, setServerImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchText, setSearchText] = useState('');

  // 判定是否启用服务端分页模式：如果是已保存任务，且本地images为空，则认为是分页模式
  const isServerMode = isSaved && !!taskDbId && (!images || images.length === 0);

  // 获取服务端数据
  const fetchImages = useCallback(async (page = 1, pageSize = 20, search = '') => {
    if (!taskDbId) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/task-images/cluster/${taskDbId}`, {
        params: { page, pageSize, search }
      });
      if (response.data.success) {
        setServerImages(response.data.data.items);
        setPagination({
          current: response.data.data.page,
          pageSize: response.data.data.pageSize,
          total: response.data.data.total
        });
      }
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      setLoading(false);
    }
  }, [taskDbId]);

  // 初始加载或模式切换时触发
  useEffect(() => {
    if (isServerMode) {
      fetchImages(1, pagination.pageSize, searchText);
    }
  }, [isServerMode, taskDbId]); // fetchImages 包含 taskDbId 依赖

  const handleTableChange = (newPagination: any) => {
    if (isServerMode) {
      fetchImages(newPagination.current, newPagination.pageSize, searchText);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    if (isServerMode) {
      fetchImages(1, pagination.pageSize, value);
    }
  };

  useEffect(() => {
    const updateScrollHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        // 减去表格头部、分页器等的高度
        // 如果有搜索栏，额外减去高度
        const offset = isServerMode ? 160 : 120;
        setScrollHeight(Math.max(300, containerHeight - offset));
      }
    };

    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);
    return () => window.removeEventListener('resize', updateScrollHeight);
  }, [isServerMode]);

  const columns = React.useMemo(() => [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      width: 200,
    },
    {
      title: '类别ID',
      dataIndex: 'cluster_id',
      key: 'cluster_id',
      width: 100,
      render: (id: number) => <Tag color="blue">类别 {id}</Tag>,
    },
    {
      title: 'L',
      dataIndex: ['lab', 'L'],
      key: 'L',
      width: 100,
      render: (value: number | undefined) => value?.toFixed(2) ?? '-',
    },
    {
      title: 'a',
      dataIndex: ['lab', 'a'],
      key: 'a',
      width: 100,
      render: (value: number | undefined) => value?.toFixed(2) ?? '-',
    },
    {
      title: 'b',
      dataIndex: ['lab', 'b'],
      key: 'b',
      width: 100,
      render: (value: number | undefined) => value?.toFixed(2) ?? '-',
    },
    {
      title: '图片路径',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
    },
  ], []);

  return (
    <div ref={containerRef} style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {isServerMode && (
         <div style={{ marginBottom: 16 }}>
           <Search placeholder="搜索文件名" onSearch={handleSearch} style={{ width: 200 }} allowClear />
         </div>
       )}
      <Table
        columns={columns}
        dataSource={isServerMode ? serverImages : images}
        rowKey={(record) => (record as any).id || record.path}
        loading={loading}
        pagination={isServerMode ? {
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
        } : { pageSize: 20 }}
        onChange={handleTableChange}
        scroll={{ y: scrollHeight }}
      />
    </div>
  );
};

export default ImageList;

