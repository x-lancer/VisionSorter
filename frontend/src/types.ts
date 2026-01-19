export interface ImageInfo {
  path: string;
  filename: string;
  lab: { L: number; a: number; b: number };
  cluster_id: number;
}

export interface ClusterInfo {
  cluster_id: number;
  count: number;
  lab_mean: number[];
  lab_std: number[];
  de2000_mean: number;
  de2000_max: number;
  de2000_std: number;
  de2000_intra_mean: number;
  de2000_intra_max: number;
  image_paths: string[];
}

export interface ClusterResult {
  success: boolean;
  total_images: number;
  n_clusters: number;
  inter_cluster_stats: {
    mean: number;
    min: number;
    max: number;
    std: number;
  };
  images: ImageInfo[];
  clusters: Record<string, ClusterInfo>;
}
