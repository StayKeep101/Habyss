import { requireOptionalNativeModule } from 'expo';

export type LiveActivityConfig = {
  name: string;
  totalDurationSeconds?: number | null;
};

// Mirrors WidgetAttributes.ContentState in ios/Widget/WidgetLiveActivity.swift
export type LiveActivityState = {
  title: string;
  subtitle: string;
  timerEndDateInMilliseconds?: number | null;
  progress: number;
  profileImagePath?: string | null;
  scheduledStartDateInMilliseconds?: number | null;
  scheduledEndDateInMilliseconds?: number | null;
  url?: string | null;
  accentHex?: string | null;
};

type HabyssLiveActivityModule = {
  areActivitiesEnabled(): boolean;
  supportsScheduledActivities?(): boolean;
  reconcileScheduledActivities?(plans: { key: string; title: string; start: number; end: number; url: string; accentHex: string }[]): Promise<{ scheduled: number; failed: number }>;
  listActivities(): string[];
  /** Echo's morning alarm (AlarmKit, iOS 26+). */
  alarmsAvailable?(): boolean;
  scheduleMorningAlarm?(hour: number, minute: number, title: string): Promise<'scheduled' | 'denied' | 'unavailable' | 'failed'>;
  cancelMorningAlarm?(): Promise<void>;
  startActivity(config: LiveActivityConfig, state: LiveActivityState): string;
  updateActivity(activityId: string, state: LiveActivityState): Promise<void>;
  stopActivity(activityId: string, state: LiveActivityState): Promise<void>;
};

// null where the native module isn't linked (Android, web, Expo Go)
export default requireOptionalNativeModule<HabyssLiveActivityModule>('HabyssLiveActivity');
