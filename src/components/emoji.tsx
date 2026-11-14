import { Image } from 'expo-image';
import { Text } from 'react-native';

/**
 * Twemoji stickers, rendered once to PNG by `scripts/make-stickers.mjs`.
 *
 * The system emoji font differs on every Android skin (and some draw them flat and
 * grey); these look the same everywhere and match the app's cartoon style.
 * Twemoji graphics © Twitter, Inc. and other contributors, licensed CC-BY 4.0.
 */
/** Values are bundled asset module ids from require(). */
const STICKERS: Record<string, number> = {
  '🐱': require('../../assets/stickers/cat_face.png'),
  '😺': require('../../assets/stickers/cat_face.png'),
  '😸': require('../../assets/stickers/grinning_cat.png'),
  '🙀': require('../../assets/stickers/weary_cat.png'),
  '😴': require('../../assets/stickers/sleeping_face.png'),
  '🔥': require('../../assets/stickers/fire.png'),
  '🎯': require('../../assets/stickers/direct_hit.png'),
  '🏆': require('../../assets/stickers/trophy.png'),
  '🫧': require('../../assets/stickers/bubbles.png'),
  '🤫': require('../../assets/stickers/shushing_face.png'),
  '⏰': require('../../assets/stickers/alarm_clock.png'),
  '⏱️': require('../../assets/stickers/alarm_clock.png'),
  '⚡': require('../../assets/stickers/high_voltage.png'),
  '📢': require('../../assets/stickers/loudspeaker.png'),
  '🌱': require('../../assets/stickers/seedling.png'),
  '🚀': require('../../assets/stickers/rocket.png'),
};

export function hasSticker(char: string): boolean {
  return char in STICKERS;
}

/** A sticker when we ship one for this emoji, otherwise the system emoji. */
export function Emoji({ char, size = 24 }: { char: string; size?: number }) {
  const source = STICKERS[char];
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessible={false}
      />
    );
  }
  return <Text style={{ fontSize: size * 0.86, lineHeight: size * 1.15 }}>{char}</Text>;
}
