import { useState } from 'react';
import axios from 'axios';
import { message } from 'antd';
import { ClusterResult } from '../types';
import { API_BASE_URL } from '../constants';

export const useCluster = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ClusterResult | null>(null);
  const [currentRequest, setCurrentRequest] = useState<{
    imageDir: string;
    nClusters: number;
  } | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  const handleCluster = async (imageDir: string, nClusters: number): Promise<ClusterResult | null> => {
    if (!imageDir.trim()) {
      message.error('请输入图片目录路径');
      return null;
    }

    if (nClusters < 1) {
      message.error('聚类数量必须大于0');
      return null;
    }

    setLoading(true);
    setCurrentRequest({ imageDir: imageDir.trim(), nClusters });
    try {
      const response = await axios.post<ClusterResult>(`${API_BASE_URL}/api/cluster-images`, {
        image_dir: imageDir.trim(),
        n_clusters: nClusters,
        center_ratio: 0.4
      });

      setResult(response.data);
      message.success('聚类完成！');
      return response.data;
    } catch (error: any) {
      message.error(error.response?.data?.detail || '聚类失败，请检查目录路径和网络连接');
      console.error('Error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentResult = async () => {
    if (!result || !currentRequest) return;

    try {
      setSaving(true);
      await axios.post(`${API_BASE_URL}/api/save-cluster-result`, {
        image_dir: currentRequest.imageDir,
        n_clusters: currentRequest.nClusters,
        result,
      });
      message.success('聚类结果已保存到本地数据库（SQLite）');
    } catch (error: any) {
      message.error(error.response?.data?.detail || '保存失败，请稍后重试');
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    result,
    handleCluster,
    setResult,
    saveCurrentResult,
    saving,
  };
};

