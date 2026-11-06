/**
 * Visual tokens for ScrollWise.
 *
 * The app is dark-only, so these are the dark-surface steps of a validated
 * palette — not a flipped light palette. The five series hues were run through the
 * palette validator against the card surface below and clear the lightness band,
 * chroma floor, adjacent-pair CVD separation, normal-vision floor and 3:1 contrast.
 * Do not hand-edit a hue here without re-validating the set.
 */

export const Surface = {
  /** Page plane. */
  page: '#0d0d0d',
  /** Card / chart surface. The surface every colour below was validated against. */
  card: '#1a1a19',
  /** Raised control. */
  raised: '#232322',
  gridline: '#2c2c2a',
  axis: '#383835',
  border: 'rgba(255,255,255,0.10)',
} as const;

export const Ink = {
  primary: '#f0efec',
  secondary: '#c3c2b7',
  muted: '#898781',
  /** Label sitting inside a filled mark. */
  onFill: '#ffffff',
} as const;

/**
 * Categorical slots, in fixed order. Assigned to apps by identity and never
 * re-assigned when a filter changes which apps are on screen — the colour follows
 * the app, not its rank.
 */
export const Series = {
  instagram: '#d55181',
  youtube: '#e66767',
  tiktok: '#199e70',
  facebook: '#3987e5',
  snapchat: '#c98500',
} as const;

/** Single hue for one-series magnitude: the 7-day bars. */
export const SequentialBase = '#3987e5';

/**
 * Sequential ramp for the hour-of-day heatmap, ordered near-zero first. On a dark
 * surface near-zero is the darkest step and recedes into the card, so magnitude
 * reads as "brighter".
 */
export const HeatRamp = [
  '#2c2c2a',
  '#184f95',
  '#256abf',
  '#3987e5',
  '#6da7ec',
  '#9ec5f4',
] as const;

/**
 * Brain state. These are status colours, reserved and never reused as a series
 * hue. Each one always ships with its label, so the state is never carried by
 * colour alone.
 */
export const BrainStatePalette = {
  healthy: { color: '#0ca30c', label: 'Healthy', blurb: 'Light scrolling today.' },
  fatigued: { color: '#fab219', label: 'Fatigued', blurb: 'Starting to add up.' },
  fried: { color: '#d03b3b', label: 'Fried', blurb: 'That is a lot of short video.' },
} as const;

/**
 * Ellie's own colours. She is a mascot, not data, so she deliberately sits outside
 * the chart palette — nothing she wears can be mistaken for a series or a status.
 * Her fur reads clearly against both `Surface.page` and `Surface.card`.
 */
export const Ellie = {
  fur: '#E2B887',
  furShade: '#C2956A',
  /** Inner ear, nose, tongue. */
  pink: '#E58BA4',
  eye: '#17160F',
  eyeShine: '#FFFFFF',
  whisker: 'rgba(255,255,255,0.45)',
  blush: 'rgba(229,139,164,0.35)',
} as const;

/**
 * Ellie's moods, and the accent that goes with each.
 *
 * The accents are the same reserved status colours the brain state uses, so a
 * colour keeps one meaning across the whole app. `label` always ships beside the
 * colour — the mood is never carried by hue alone.
 */
export const MoodPalette = {
  content: { accent: '#0ca30c', label: 'Content' },
  proud: { accent: '#0ca30c', label: 'Proud' },
  watchful: { accent: '#fab219', label: 'Watchful' },
  worried: { accent: '#d03b3b', label: 'Worried' },
  sleepy: { accent: '#898781', label: 'Sleepy' },
} as const;

export type Mood = keyof typeof MoodPalette;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  /** Data-end radius on bars and cells. */
  mark: 4,
  pill: 999,
  control: 12,
  card: 18,
  sheet: 24,
} as const;

/**
 * Concentric radius: something inset by `pad` inside a `outer`-radius container
 * should curve by `outer - pad`, or the two curves fight each other.
 */
export function innerRadius(outer: number, pad: number): number {
  return Math.max(Radius.mark, outer - pad);
}

/**
 * One type ramp, named by what a thing *is* rather than by its size, so a screen
 * cannot quietly invent a fourteenth font size.
 */
export const Type = {
  /** The count itself. Nothing else uses this. */
  hero: { fontSize: 56, lineHeight: 60, fontWeight: '700' } as const,
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' } as const,
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' } as const,
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' } as const,
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' } as const,
  /** Ellie's speech, one step up from body so she reads as a voice. */
  speech: { fontSize: 16, lineHeight: 24, fontWeight: '400' } as const,
  label: { fontSize: 13, lineHeight: 18, fontWeight: '500' } as const,
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400' } as const,
  /** Axis ticks and table columns, where digits must line up. */
  tick: { fontSize: 11, lineHeight: 15, fontWeight: '400' } as const,
} as const;

/** Shared motion timings, so nothing animates at an arbitrary speed. */
export const Motion = {
  /** Press feedback. */
  pressScale: 0.96,
  fast: 140,
  base: 220,
  slow: 420,
  /** Gap between staggered children entering. */
  stagger: 45,
} as const;

export const AppLabels: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
};
