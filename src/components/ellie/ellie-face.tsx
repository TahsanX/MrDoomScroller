import { memo, useEffect, useState } from 'react';
import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

import { Ellie, MoodPalette, type Mood } from '@/constants/theme';

/**
 * Ellie, drawn rather than imported.
 *
 * Every mood is a different set of shapes — eyes, brows, mouth, ear angle — instead
 * of a different asset, which is the whole reason she is SVG: a rendered image would
 * need one file per expression and still could not blink.
 *
 * Blinking is React state on a randomised interval rather than an animated SVG prop.
 * It is a discrete swap a few times a minute, so driving it from the JS side costs
 * nothing and avoids `useAnimatedProps` on every eye.
 */

const VIEW = 140;

type Props = {
  mood: Mood;
  size?: number;
  /** Blinking is suppressed while she is asleep — closed eyes cannot blink. */
  blink?: boolean;
};

export const EllieFace = memo(function EllieFace({ mood, size = 150, blink = true }: Props) {
  const blinking = useBlink(blink && mood !== 'sleepy');
  const eyesClosed = mood === 'sleepy' || blinking;
  const ear = earAngle(mood);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      {/* Chest, behind the head, so she is a cat rather than a floating head. */}
      <Path
        d="M44 118 Q44 96 70 96 Q96 96 96 118 Q96 126 70 126 Q44 126 44 118 Z"
        fill={Ellie.furShade}
      />

      <G rotation={-ear} origin="44, 52">
        <Polygon points="30,56 34,20 60,44" fill={Ellie.fur} />
        <Polygon points="36,50 38,30 52,44" fill={Ellie.pink} />
      </G>
      <G rotation={ear} origin="96, 52">
        <Polygon points="110,56 106,20 80,44" fill={Ellie.fur} />
        <Polygon points="104,50 102,30 88,44" fill={Ellie.pink} />
      </G>

      <Ellipse cx="70" cy="74" rx="42" ry="37" fill={Ellie.fur} />

      {/* Forehead stripes — what makes her read as a tabby rather than a blob. */}
      <Path d="M62 42 L66 54" stroke={Ellie.furShade} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M70 40 L70 53" stroke={Ellie.furShade} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M78 42 L74 54" stroke={Ellie.furShade} strokeWidth="3.5" strokeLinecap="round" />

      <Eyes mood={mood} closed={eyesClosed} />

      <Ellipse cx="46" cy="86" rx="8" ry="5.5" fill={Ellie.blush} />
      <Ellipse cx="94" cy="86" rx="8" ry="5.5" fill={Ellie.blush} />

      {/* Muzzle */}
      <Path d="M70 84 L65 89 Q70 93 75 89 Z" fill={Ellie.pink} />
      <Mouth mood={mood} />

      <Whiskers />
    </Svg>
  );
});

function Eyes({ mood, closed }: { mood: Mood; closed: boolean }) {
  const stroke = Ellie.eye;

  if (closed) {
    // Closed lids curve downward, the way a cat's do when it is content or asleep.
    return (
      <G>
        <Path d="M44 72 Q52 79 60 72" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <Path d="M80 72 Q88 79 96 72" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      </G>
    );
  }

  if (mood === 'proud') {
    // Happy arcs — the eyes a cat makes when it is pleased with itself.
    return (
      <G>
        <Path d="M44 74 Q52 65 60 74" stroke={stroke} strokeWidth="4" strokeLinecap="round" fill="none" />
        <Path d="M80 74 Q88 65 96 74" stroke={stroke} strokeWidth="4" strokeLinecap="round" fill="none" />
      </G>
    );
  }

  // Open. Worry widens the eye and shrinks the pupil; watchfulness narrows it.
  const ry = mood === 'worried' ? 11 : mood === 'watchful' ? 6.5 : 9;
  const pupil = mood === 'worried' ? 2.6 : 4;

  return (
    <G>
      <Ellipse cx="52" cy="71" rx="8.5" ry={ry} fill={stroke} />
      <Ellipse cx="88" cy="71" rx="8.5" ry={ry} fill={stroke} />
      <Circle cx="54.5" cy={71 - pupil / 2} r={pupil} fill={Ellie.eyeShine} opacity={0.9} />
      <Circle cx="90.5" cy={71 - pupil / 2} r={pupil} fill={Ellie.eyeShine} opacity={0.9} />
      {mood === 'watchful' ? (
        // A lowered brow is what separates "narrowed" from "sleepy".
        <G>
          <Path d="M43 60 L61 64" stroke={Ellie.furShade} strokeWidth="3" strokeLinecap="round" />
          <Path d="M97 60 L79 64" stroke={Ellie.furShade} strokeWidth="3" strokeLinecap="round" />
        </G>
      ) : null}
    </G>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  const common = { stroke: Ellie.eye, strokeWidth: 2.6, strokeLinecap: 'round' as const, fill: 'none' };
  if (mood === 'worried') {
    return <Path d="M62 99 Q70 94 78 99" {...common} />;
  }
  if (mood === 'sleepy') {
    return <Path d="M66 96 Q70 99 74 96" {...common} />;
  }
  // The classic cat ω.
  return <Path d="M61 94 Q65.5 100 70 94 Q74.5 100 79 94" {...common} />;
}

function Whiskers() {
  const common = {
    stroke: Ellie.whisker,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  return (
    <G>
      <Path d="M36 84 Q22 80 12 82" {...common} />
      <Path d="M36 90 Q22 90 11 93" {...common} />
      <Path d="M104 84 Q118 80 128 82" {...common} />
      <Path d="M104 90 Q118 90 129 93" {...common} />
    </G>
  );
}

/** Ears prick up when she is alert and flatten when she is not. */
function earAngle(mood: Mood): number {
  switch (mood) {
    case 'worried':
      return 22;
    case 'sleepy':
      return 16;
    case 'watchful':
      return 4;
    default:
      return 0;
  }
}

/**
 * A blink every few seconds, at an irregular interval. A metronome-steady blink
 * reads as a machine; the irregularity is what makes her look alive.
 */
function useBlink(enabled: boolean): boolean {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let pending: ReturnType<typeof setTimeout>;
    const schedule = () => {
      pending = setTimeout(() => {
        setBlinking(true);
        pending = setTimeout(() => {
          setBlinking(false);
          schedule();
        }, 130);
      }, 2600 + Math.random() * 3200);
    };
    schedule();
    return () => clearTimeout(pending);
  }, [enabled]);

  // Derived rather than reset in the effect: when she stops blinking the answer is
  // simply "no", and writing that back into state would re-render for nothing.
  return enabled && blinking;
}

/** Just the head, flattened for small sizes — the launcher icon and the pill. */
export function EllieMark({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      <Polygon points="30,56 34,20 60,44" fill={Ellie.fur} />
      <Polygon points="110,56 106,20 80,44" fill={Ellie.fur} />
      <Ellipse cx="70" cy="74" rx="42" ry="37" fill={Ellie.fur} />
      <Ellipse cx="52" cy="71" rx="7" ry="8" fill={Ellie.eye} />
      <Ellipse cx="88" cy="71" rx="7" ry="8" fill={Ellie.eye} />
      <Path d="M70 84 L65 89 Q70 93 75 89 Z" fill={Ellie.pink} />
    </Svg>
  );
}

export { MoodPalette };
