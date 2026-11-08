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

/** One card on the timeline, and what comes after it (shown once its time is up). */
export type ScheduledPlan = {
  key: string; title: string; start: number; end: number; url: string; accentHex: string;
  /** "habit:<id>" or "task:<id>": the card's Done button ticks it. */
  itemId?: string | null;
  nextTitle?: string | null; nextStart?: number | null; nextEnd?: number | null; nextItemId?: string | null; nextUrl?: string | null;
};

type HabyssLiveActivityModule = {
  areActivitiesEnabled(): boolean;
  /** Low Power Mode is on (native from runtime 1.0.4). */
  isLowPowerMode?(): boolean;
  supportsScheduledActivities?(): boolean;
  reconcileScheduledActivities?(plans: ScheduledPlan[]): Promise<{ scheduled: number; failed: number }>;
  /** Leave now and Start now as alarms (AlarmKit, iOS 26+): ring through Silent and on the Watch. Replaces today's set. */
  scheduleMomentAlarms?(moments: { at: number; title: string }[]): Promise<'scheduled' | 'denied' | 'unavailable' | 'failed'>;
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
