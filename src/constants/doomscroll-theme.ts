/**
 * Visual tokens for MrDoomScroller.
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
  control: 12,
  card: 16,
} as const;

export const AppLabels: Record<string, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  snapchat: 'Snapchat',
};
