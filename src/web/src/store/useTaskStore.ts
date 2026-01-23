import { create } from 'zustand';
import { Task, TaskType, TaskStatus, ClusterResult, DetectionResult } from '../types';

interface SavedClusterResult {
  id: number;
  task_name: string;
  created_at: string;
  clusterResult: ClusterResult;
}

interface TaskStore {
  // 数据状态
  tasks: Task[];
  savedClusterResults: SavedClusterResult[];
  
  // Actions
  setTasks: (tasks: Task[] | ((prev: Task[]) => Task[])) => void;
  setSavedClusterResults: (results: SavedClusterResult[]) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  updateTaskParams: (taskId: string, params: Partial<Task['params']>) => void;
  deleteTask: (taskId: string) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  savedClusterResults: [],

  setTasks: (tasksOrUpdater) => set((state) => {
    const newTasks = typeof tasksOrUpdater === 'function' 
      ? tasksOrUpdater(state.tasks)
      : tasksOrUpdater;
    return { tasks: newTasks };
  }),

  setSavedClusterResults: (results) => set({ savedClusterResults: results }),

  addTask: (task) => set((state) => ({ 
    tasks: [...state.tasks, task] 
  })),

  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
  })),

  updateTaskParams: (taskId, params) => set((state) => ({
    tasks: state.tasks.map((t) => 
      t.id === taskId ? { ...t, params: { ...t.params, ...params } } : t
    )
  })),

  deleteTask: (taskId) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== taskId)
  })),
}));
