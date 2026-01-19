import { useState } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { ClusterResult } from '../types';
import { API_BASE_URL } from '../constants';

export const useCluster = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ClusterResult | null>(null);

  const handleCluster = async (imageDir: string, nClusters: number) => {
    if (!imageDir.trim()) {
      message.error('请输入图片目录路径');
      return;
    }

    if (nClusters < 1) {
      message.error('聚类数量必须大于0');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post<ClusterResult>(`${API_BASE_URL}/api/cluster-images`, {
        image_dir: imageDir.trim(),
        n_clusters: nClusters,
        center_ratio: 0.4
      });

      setResult(response.data);
      message.success('聚类完成！');
    } catch (error: any) {
      message.error(error.response?.data?.detail || '聚类失败，请检查目录路径和网络连接');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    result,
    handleCluster,
    setResult,
  };
};

