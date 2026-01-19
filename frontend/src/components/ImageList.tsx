import React, { useEffect, useRef, useState } from 'react';
import { Table, Tag } from 'antd';
import { ImageInfo } from '../types';

interface ImageListProps {
  images: ImageInfo[];
}

const ImageList: React.FC<ImageListProps> = ({ images }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollHeight, setScrollHeight] = useState<number>(400);

  useEffect(() => {
    const updateScrollHeight = () => {
      if (containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        // 减去表格头部、分页器等的高度（大约 120px）
        setScrollHeight(Math.max(300, containerHeight - 120));
      }
    };

    updateScrollHeight();
    window.addEventListener('resize', updateScrollHeight);
    return () => window.removeEventListener('resize', updateScrollHeight);
  }, []);

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
      render: (id: number) => <Tag color="blue">类别 {id + 1}</Tag>, // 显示时从1开始
    },
    {
      title: 'L',
      dataIndex: ['lab', 'L'],
      key: 'L',
      width: 100,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: 'a',
      dataIndex: ['lab', 'a'],
      key: 'a',
      width: 100,
      render: (value: number) => value.toFixed(2),
    },
    {
      title: 'b',
      dataIndex: ['lab', 'b'],
      key: 'b',
      width: 100,
      render: (value: number) => value.toFixed(2),
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
      <Table
        columns={columns}
        dataSource={images}
        rowKey="path"
        pagination={{ pageSize: 20 }}
        scroll={{ y: scrollHeight }}
      />
    </div>
  );
};

export default ImageList;

