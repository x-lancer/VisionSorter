import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Empty, Image, Input, Pagination, Skeleton, Space, Tag, Typography } from 'antd';
import { API_BASE_URL } from '../constants';
import type { TaskType } from '../types';

const { Text } = Typography;
const { Search } = Input;

type ServerItem = {
  id: number;
  filename: string;
  path: string;
  cluster_id?: number | null;
  matched_cluster_id?: number | null;
  status?: string;
  distance?: number | null;
  elapsed_time?: number;
};

type ApiResponse = {
  success: boolean;
  data: {
    items: ServerItem[];
    total: number;
    page: number;
    pageSize: number;
  };
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

const LazyImage: React.FC<{
  src: string;
  alt?: string;
  width: number;
  height: number;
}> = ({ src, alt, width, height }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.01 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <div ref={ref} style={{ width, height }}>
      {visible ? (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{
            objectFit: 'cover',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.06)',
            background: '#f5f5f5',
          }}
          preview={{ mask: '预览' }}
        />
      ) : (
        <Skeleton.Image
          style={{
            width,
            height,
            borderRadius: 8,
          }}
          active
        />
      )}
    </div>
  );
};

export interface TaskImagesGridProps {
  taskType: TaskType;
  taskDbId: number;
  clusterId?: number | null;
  pageSize?: number;
  showSearch?: boolean;
  height?: number | string;
  emptyText?: string;
}

export const TaskImagesGrid: React.FC<TaskImagesGridProps> = ({
  taskType,
  taskDbId,
  clusterId,
  pageSize = 20,
  showSearch = true,
  height = '100%',
  emptyText = '暂无数据',
}) => {
  const [items, setItems] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSizeState, setPageSizeState] = useState(pageSize);
  const [total, setTotal] = useState(0);
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebouncedValue(searchText, 300);

  const fetchPage = useCallback(
    async (nextPage: number, nextPageSize: number, search: string, cid?: number | null) => {
      setLoading(true);
      try {
        const resp = await axios.get<any, { data: ApiResponse }>(
          `${API_BASE_URL}/api/task-images/${taskType}/${taskDbId}`,
          {
            params: {
              page: nextPage,
              pageSize: nextPageSize,
              search: search || '',
              clusterId: cid ?? undefined,
            },
          },
        );

        if (resp.data?.success) {
          setItems(resp.data.data.items || []);
          setTotal(resp.data.data.total || 0);
          setPage(resp.data.data.page || nextPage);
          setPageSizeState(resp.data.data.pageSize || nextPageSize);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch task images:', e);
      } finally {
        setLoading(false);
      }
    },
    [taskDbId, taskType],
  );

  // 当筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [taskDbId, taskType, clusterId, debouncedSearch]);

  // 拉取数据
  useEffect(() => {
    fetchPage(1, pageSizeState, debouncedSearch, clusterId);
  }, [fetchPage, taskDbId, taskType, clusterId, debouncedSearch, pageSizeState]);

  const header = useMemo(() => {
    const countLabel = total ? `共 ${total} 张` : '共 0 张';
    return (
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {countLabel}
        </Text>
        {showSearch ? (
          <Search
            allowClear
            placeholder="搜索文件名"
            style={{ width: 220 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        ) : null}
      </Space>
    );
  }, [searchText, showSearch, total]);

  const grid = useMemo(() => {
    const thumb = 120;
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 12,
          alignContent: 'start',
        }}
      >
        {items.map((it) => {
          const imageUrl = `${API_BASE_URL}/api/image?path=${encodeURIComponent(it.path)}`;
          const cid = it.cluster_id ?? it.matched_cluster_id;
          const cidLabel =
            cid == null ? (
              <Tag style={{ margin: 0 }} color="default">
                未归类
              </Tag>
            ) : (
              <Tag style={{ margin: 0 }} color="blue">
                类别 {cid}
              </Tag>
            );

          return (
            <div
              key={it.id ?? it.path}
              style={{
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 10,
                padding: 10,
                background: '#fff',
              }}
            >
              <LazyImage src={imageUrl} alt={it.filename} width={thumb} height={thumb} />
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  {cidLabel}
                  {it.status ? (
                    <Tag style={{ margin: 0 }} color={it.status === '已归类' ? 'success' : 'default'}>
                      {it.status}
                    </Tag>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    lineHeight: '16px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={it.filename}
                >
                  {it.filename}
                </div>
                {typeof it.distance === 'number' ? (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                    ΔE2000: {it.distance.toFixed(2)}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }, [items]);

  return (
    <div style={{ height, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>{header}</div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                active
                avatar={false}
                title={{ width: '60%' }}
                paragraph={{ rows: 2, width: ['90%', '70%'] }}
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Empty description={emptyText} />
        ) : (
          grid
        )}
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <Pagination
          current={page}
          pageSize={pageSizeState}
          total={total}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={['10', '20', '50', '100']}
          showTotal={(t) => `共 ${t} 张`}
          onChange={(p, ps) => {
            fetchPage(p, ps, debouncedSearch, clusterId);
          }}
        />
      </div>
    </div>
  );
};

