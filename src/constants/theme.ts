/**
 * Visual tokens for ScrollWise.
 *
 * Light, bright and a little cartoonish: a soft lavender page, white sticker-like
 * cards, and one candy colour per idea. 60/30/10 — the lavender/white neutrals carry
 * most of the screen, deep violet ink does the reading, and the candy hues are
 * spent on the things worth looking at (the count, the streak, the mode switch).
 *
 * Shadows are tinted violet, never grey, so cards float on the lavender rather than
 * looking dirty on it.
 */

export const Surface = {
  /** Page plane. */
  page: '#F5F2FF',
  /** Card / chart surface. */
  card: '#FFFFFF',
  /** Raised control, chip track, input. */
  raised: '#EFEAFD',
  gridline: '#ECE7FA',
  axis: '#D8D0F2',
  border: 'rgba(108,76,245,0.10)',
} as const;

export const Ink = {
  primary: '#221A3A',
  secondary: '#4B4466',
  muted: '#7F789A',
  /** Label sitting inside a filled mark. */
  onFill: '#ffffff',
} as const;

/**
 * The candy set. Each has a strong form for marks and text-on-white, and a soft
 * tint for the card it lives on.
 */
export const Candy = {
  violet: '#6C4CF5',
  violetSoft: '#ECE6FF',
  coral: '#FF5C70',
  coralSoft: '#FFE7EA',
  mint: '#14B88A',
  mintSoft: '#DCF7EE',
  sun: '#F5A300',
  sunSoft: '#FFF2D1',
  sky: '#2E9BF0',
  skySoft: '#E0F0FF',
  pink: '#F25BB5',
  pinkSoft: '#FFE5F4',
} as const;

/** Soft tinted shadow for floating cards. Spread into a style. */
export const Lift = {
  shadowColor: '#5B3FD9',
  shadowOpacity: 0.12,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 4,
} as const;

/**
 * Categorical slots, in fixed order. Assigned to apps by identity and never
 * re-assigned when a filter changes which apps are on screen — the colour follows
 * the app, not its rank. Each clears 3:1 against the white card.
 */
export const Series = {
  instagram: '#E2407E',
  youtube: '#EE3E3E',
  tiktok: '#0FA79A',
  facebook: '#3778E8',
  snapchat: '#D99400',
} as const;

/** Soft card tint per app, for the coloured per-app tiles. */
export const SeriesSoft = {
  instagram: '#FFE6F0',
  youtube: '#FFE5E5',
  tiktok: '#DDF6F3',
  facebook: '#E2ECFF',
  snapchat: '#FFF3CF',
} as const;

/** A sticker emoji per app, so a tile reads before its label does. */
export const AppSticker = {
  instagram: '📸',
  youtube: '▶️',
  tiktok: '🎵',
  facebook: '👍',
  snapchat: '👻',
} as const;

/** Single hue for one-series magnitude: the 7-day bars. */
export const SequentialBase = Candy.violet;

/**
 * Sequential ramp for the hour-of-day heatmap, ordered near-zero first. On a light
 * surface near-zero is the palest step, so magnitude reads as "deeper".
 */
export const HeatRamp = [
  '#EFEAFD',
  '#D6CAFF',
  '#B6A1FF',
  '#9479FB',
  '#7652F2',
  '#5531D4',
] as const;

/**
 * Brain state. Status colours, reserved and never reused as a series hue. Each one
 * always ships with its label, so the state is never carried by colour alone.
 */
export const BrainStatePalette = {
  healthy: { color: '#14B88A', label: 'Healthy', blurb: 'Light scrolling today.' },
  fatigued: { color: '#F5A300', label: 'Fatigued', blurb: 'Starting to add up.' },
  fried: { color: '#FF5C70', label: 'Fried', blurb: 'That is a lot of short video.' },
} as const;

/**
 * Ellie's own colours. She is a mascot, not data, so she sits outside the chart
 * palette. A dark brown outline gives her the sticker/cartoon edge on light pages.
 */
export const Ellie = {
  fur: '#F4C28D',
  furShade: '#D99A62',
  /** Cartoon outline. */
  outline: '#5A3A22',
  /** Inner ear, nose, tongue. */
  pink: '#FF8FB1',
  eye: '#2A1B12',
  eyeShine: '#FFFFFF',
  whisker: 'rgba(90,58,34,0.45)',
  blush: 'rgba(255,120,150,0.45)',
} as const;

/**
 * Ellie's moods, the accent that goes with each, and the soft hero tint behind her.
 * `label` always ships beside the colour — the mood is never carried by hue alone.
 */
export const MoodPalette = {
  content: { accent: '#14B88A', soft: '#DCF7EE', label: 'Content', emoji: '😺' },
  proud: { accent: '#14B88A', soft: '#DCF7EE', label: 'Proud', emoji: '😸' },
  watchful: { accent: '#F5A300', soft: '#FFF2D1', label: 'Watchful', emoji: '🙀' },
  worried: { accent: '#FF5C70', soft: '#FFE7EA', label: 'Worried', emoji: '😿' },
  sleepy: { accent: '#6C4CF5', soft: '#ECE6FF', label: 'Sleepy', emoji: '😴' },
} as const;

/** Hero gradient pairs per mood: top-left → bottom-right. */
export const MoodGradient: Record<keyof typeof MoodPalette, [string, string]> = {
  content: ['#7C5CFF', '#B57BFF'],
  proud: ['#16C79A', '#6C4CF5'],
  watchful: ['#FF9F1C', '#FF5C9A'],
  worried: ['#FF5C70', '#B23CF0'],
  sleepy: ['#5B49E8', '#2E9BF0'],
};

export type Mood = keyof typeof MoodPalette;

/** Nunito: round terminals, friendly at every size. Two weights only. */
export const Font = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_800ExtraBold',
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
  pill: 999,
  control: 16,
  card: 24,
  sheet: 32,
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
  hero: { fontSize: 64, lineHeight: 68, fontFamily: Font.bold } as const,
  display: { fontSize: 30, lineHeight: 36, fontFamily: Font.bold } as const,
  title: { fontSize: 22, lineHeight: 28, fontFamily: Font.bold } as const,
  heading: { fontSize: 17, lineHeight: 22, fontFamily: Font.bold } as const,
  body: { fontSize: 15, lineHeight: 22, fontFamily: Font.regular } as const,
  /** Ellie's speech, one step up from body so she reads as a voice. */
  speech: { fontSize: 16, lineHeight: 23, fontFamily: Font.regular } as const,
  label: { fontSize: 14, lineHeight: 18, fontFamily: Font.bold } as const,
  caption: { fontSize: 13, lineHeight: 18, fontFamily: Font.regular } as const,
  /** Axis ticks and table columns, where digits must line up. */
  tick: { fontSize: 11, lineHeight: 15, fontFamily: Font.regular } as const,
} as const;

/** Shared motion timings, so nothing animates at an arbitrary speed. */
export const Motion = {
  /** Press feedback. */
  pressScale: 0.95,
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
