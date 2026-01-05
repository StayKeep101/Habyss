export interface Habit {
  id: string;
  title: string;
  icon: string;
  streak: number;
  weeklyCompletionRate: number;
  color: string;
}

export interface Goal {
  id: string;
  title: string;
  icon: string;
  targetDate: string;
  progress: number; // 0-100
  habits: Habit[];
  milestones: {
    title: string;
    completed: boolean;
    date: string;
  }[];
  projectedCompletionDate: string;
  status: 'on_track' | 'ahead' | 'behind';
}

export interface WeeklyData {
  day: string;
  completionRate: number;
  date: string;
}

export interface HeatmapData {
  date: string;
  count: number; // number of habits completed
  intensity: number; // 0-4 scale
}

export interface DashboardData {
  currentStreak: number;
  bestStreak: number;
  percentAboveBest: number;
  percentile: number;
  goalsProgress: number;
  weeklyCompletionRate: number;
  weeklyData: WeeklyData[];
  goals: Goal[];
  heatmapData: HeatmapData[];
  habitScore?: number;
  consistencyScore?: number;
}
