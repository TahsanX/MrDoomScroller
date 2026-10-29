export type AppId = 'instagram' | 'youtube' | 'tiktok' | 'facebook' | 'snapchat';

export type BlockMode = 'NOTIFY' | 'NUDGE' | 'HARD';

/**
 * How fried the user is. Derived from the daily total against the user's own
 * thresholds — it is the app's opinion, not a clinical finding, and the UI says so.
 */
export type BrainState = 'healthy' | 'fatigued' | 'fried';

export type AppCount = {
  appId: AppId;
  count: number;
};

export type Today = {
  /** Local-timezone ISO date, `yyyy-MM-dd`. */
  date: string;
  total: number;
  /** Attributed watch time in milliseconds, summed over counted reels. */
  feedMs: number;
  brainState: BrainState;
  apps: AppCount[];
};

export type DayTotal = {
  date: string;
  total: number;
  feedMs: number;
};

export type RangeResult = {
  days: DayTotal[];
  apps: AppCount[];
};

export type HourBucket = {
  /** 0-23, in the user's own timezone. */
  hour: number;
  count: number;
};

export type Insights = {
  hours: HourBucket[];
  averageDwellMs: number;
};

export type TargetAppInfo = {
  appId: AppId;
  label: string;
  packages: string[];
  /**
   * True while the detection profile for this app has not been verified against a
   * real device. The UI must surface this: a number the user cannot trust is worse
   * than no number.
   */
  experimental: boolean;
};

export type Settings = {
  /** 0 disables the daily cap. */
  dailyLimit: number;
  /** Reels per sitting. 0 disables. */
  sessionLimit: number;
  blockMode: BlockMode;
  overlayEnabled: boolean;
  enabledApps: AppId[];
  debugLogging: boolean;
  onboardingComplete: boolean;
  healthyMax: number;
  fatiguedMax: number;
};

export type SettingsPatch = Partial<Settings>;

export type ExportBundle = {
  exportedAt: number;
  settings: Settings;
  days: DayTotal[];
  appStats: { date: string; appId: AppId; count: number }[];
  events: { timestamp: number; appId: AppId; dwellMs: number }[];
};

export type ReelCountedEvent = {
  appId: AppId;
  /** Running total for today, after this reel. */
  total: number;
  dwellMs: number;
};

export type LimitReachedEvent = {
  appId: AppId;
  total: number;
  limit: number;
};

export type DoomScrollCoreEvents = {
  onReelCounted: (event: ReelCountedEvent) => void;
  onLimitReached: (event: LimitReachedEvent) => void;
};
