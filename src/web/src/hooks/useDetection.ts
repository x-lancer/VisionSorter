import { useState, useRef } from 'react';
import { message } from 'antd';
import { API_BASE_URL } from '../constants';
import type { ClusterResult } from '../types';

export interface DetectionResult {
  filename: string;
  path: string;
  lab: {
    L: number;
    a: number;
    b: number;
  } | null;
  matched_cluster_id: number | null;
  distance: number | null;
  status: string;
}

export const useDetection = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<DetectionResult[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(-1);
  const wsRef = useRef<WebSocket | null>(null);
  const resultsRef = useRef<DetectionResult[]>([]);
  const isFinishedRef = useRef<boolean>(false);

  const handleDetection = (
    imageDir: string,
    clusterResult: ClusterResult,
    onProgress?: (index: number, total: number, current: DetectionResult) => void
  ): Promise<DetectionResult[] | null> => {
    return new Promise((resolve, reject) => {
      if (!imageDir.trim()) {
        message.error('请输入待检测图片目录路径');
        resolve(null);
        return;
      }

      if (!clusterResult || !clusterResult.clusters) {
        message.error('聚类结果无效');
        resolve(null);
        return;
      }

      setLoading(true);
      setResults([]);
      setCurrentImageIndex(-1);
      resultsRef.current = [];
      isFinishedRef.current = false;

      // 构建 WebSocket URL
      let wsUrl: string;
      if (API_BASE_URL.startsWith('https://')) {
        wsUrl = API_BASE_URL.replace('https://', 'wss://') + '/ws/detect-images';
      } else {
        wsUrl = API_BASE_URL.replace('http://', 'ws://') + '/ws/detect-images';
      }
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // 连接打开后发送初始化参数
      ws.onopen = () => {
        ws.send(JSON.stringify({
          image_dir: imageDir.trim(),
          cluster_result: clusterResult,
          max_scale: 1.1,
        }));
      };

      // 接收消息
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'start') {
            // 开始检测
            console.log(`开始检测，共 ${data.total} 张图片`);
          } else if (data.type === 'progress') {
            // 单张图片检测结果
            const result: DetectionResult = data.result;
            const index = data.index;
            const total = data.total;

            // 实时更新结果列表
            resultsRef.current = [...resultsRef.current, result];
            setResults(resultsRef.current);
            setCurrentImageIndex(index);

            // 调用进度回调
            if (onProgress) {
              onProgress(index, total, result);
            }
          } else if (data.type === 'completed') {
            // 检测完成
            isFinishedRef.current = true;
            setLoading(false);
            setCurrentImageIndex(resultsRef.current.length - 1);
            message.success(`检测完成！共检测 ${data.total} 张图片，成功归类 ${data.classified} 张`);
            ws.close();
            resolve([...resultsRef.current]);
          } else if (data.type === 'cancelled') {
            // 检测被取消
            isFinishedRef.current = true;
            setLoading(false);
            message.info(`检测已取消，已处理 ${data.processed}/${data.total} 张图片`);
            ws.close();
            resolve([...resultsRef.current]);
          } else if (data.type === 'error') {
            // 检测出错
            isFinishedRef.current = true;
            setLoading(false);
            message.error(data.message || '检测过程中发生错误');
            ws.close();
            reject(new Error(data.message || '检测失败'));
          }
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      };

      // 连接错误
      ws.onerror = (error) => {
        // 如果已经在完成/取消/错误中处理过结果，则忽略后续错误事件，避免误报
        if (isFinishedRef.current) {
          console.warn('WebSocket error after finished, ignored:', error);
          return;
        }
        setLoading(false);
        message.error('WebSocket 连接错误，请检查网络连接');
        console.error('WebSocket error:', error);
        reject(error);
      };

      // 连接关闭
      ws.onclose = () => {
        setLoading(false);
        wsRef.current = null;
      };
    });
  };

  // 取消检测
  const cancelDetection = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send('cancel');
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  return {
    loading,
    results,
    currentImageIndex,
    handleDetection,
    cancelDetection,
    setResults,
    setCurrentImageIndex,
  };
};
