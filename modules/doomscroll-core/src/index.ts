import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type {
  DoomScrollCoreEvents,
  ExportBundle,
  Insights,
  RangeResult,
  Settings,
  SettingsPatch,
  TargetAppInfo,
  Today,
} from './DoomScrollCore.types';

export * from './DoomScrollCore.types';

type NativeModule = {
  isServiceEnabled(): boolean;
  hasOverlayPermission(): boolean;
  openAccessibilitySettings(): void;
  openOverlaySettings(): void;
  getToday(): Promise<Today>;
  getRange(from: string, to: string): Promise<RangeResult>;
  getInsights(days: number): Promise<Insights>;
  getTargetApps(): TargetAppInfo[];
  getSettings(): Promise<Settings>;
  setSettings(patch: SettingsPatch): Promise<Settings>;
  resetToday(): Promise<number>;
  exportAll(): Promise<ExportBundle>;
  addListener<K extends keyof DoomScrollCoreEvents>(
    event: K,
    listener: DoomScrollCoreEvents[K]
  ): { remove(): void };
};

/**
 * Optional rather than required, so Expo Go and the web bundle load instead of
 * throwing at import time. Everything this module does is Android-only by nature —
 * no other platform exposes individual scroll events — so the UI has to render
 * sensibly without it and say why.
 */
const native = requireOptionalNativeModule<NativeModule>('DoomScrollCore');

/** False on web, in Expo Go, and on any build without the native module. */
export const isSupported = Platform.OS === 'android' && native != null;

const EMPTY_TODAY: Today = {
  date: new Date().toISOString().slice(0, 10),
  total: 0,
  feedMs: 0,
  brainState: 'healthy',
  apps: [],
};

const DEFAULT_SETTINGS: Settings = {
  dailyLimit: 0,
  sessionLimit: 0,
  blockMode: 'NUDGE',
  overlayEnabled: true,
  enabledApps: ['instagram', 'youtube', 'tiktok', 'facebook', 'snapchat'],
  debugLogging: false,
  onboardingComplete: false,
  healthyMax: 20,
  fatiguedMax: 60,
};

export function isServiceEnabled(): boolean {
  return native?.isServiceEnabled() ?? false;
}

export function hasOverlayPermission(): boolean {
  return native?.hasOverlayPermission() ?? false;
}

/**
 * Takes the user to system settings. Android offers no in-app grant for the
 * accessibility permission, which is why onboarding has to earn it first.
 */
export function openAccessibilitySettings(): void {
  native?.openAccessibilitySettings();
}

export function openOverlaySettings(): void {
  native?.openOverlaySettings();
}

export function getToday(): Promise<Today> {
  return native?.getToday() ?? Promise.resolve(EMPTY_TODAY);
}

export function getRange(from: string, to: string): Promise<RangeResult> {
  return native?.getRange(from, to) ?? Promise.resolve({ days: [], apps: [] });
}

export function getInsights(days = 30): Promise<Insights> {
  return native?.getInsights(days) ?? Promise.resolve({ hours: [], averageDwellMs: 0 });
}

export function getTargetApps(): TargetAppInfo[] {
  return native?.getTargetApps() ?? [];
}

export function getSettings(): Promise<Settings> {
  return native?.getSettings() ?? Promise.resolve(DEFAULT_SETTINGS);
}

export function setSettings(patch: SettingsPatch): Promise<Settings> {
  return native?.setSettings(patch) ?? Promise.resolve({ ...DEFAULT_SETTINGS, ...patch });
}

export function resetToday(): Promise<number> {
  return native?.resetToday() ?? Promise.resolve(0);
}

export function exportAll(): Promise<ExportBundle> {
  return (
    native?.exportAll() ??
    Promise.resolve({
      exportedAt: Date.now(),
      settings: DEFAULT_SETTINGS,
      days: [],
      appStats: [],
      events: [],
    })
  );
}

/**
 * Live updates while the app is in the foreground. Returns a no-op unsubscribe when
 * the native module is absent so callers never have to null-check in an effect.
 */
export function addListener<K extends keyof DoomScrollCoreEvents>(
  event: K,
  listener: DoomScrollCoreEvents[K]
): { remove(): void } {
  return native?.addListener(event, listener) ?? { remove: () => {} };
}
