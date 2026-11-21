import { Platform, useColorScheme, type ViewStyle } from 'react-native';

import { useStore } from '@/state/store';

/**
 * Tokens from LifeQuest_Design_Specification_v1 §02:
 * Forest #316E54 · Mint #D5F2D1 · Sky #BDE7F6 · Peach #FFE4D1 · Gold #F9C766
 * Lavender #E7DFF9 · Ink #273D35 · Paper #FFFDF7. Soft optimism with strong readability.
 */
const light = {
  canvas: '#FFFDF7', // paper
  surface: '#FFFFFF',
  border: '#E6ECE6',
  ink: '#273D35',
  muted: '#5E6F67',
  faint: '#93A39A',

  forest: '#316E54',
  forestBright: '#3F8F66',
  onForest: '#FFFFFF',
  mint: '#D5F2D1',
  sky: '#BDE7F6',
  peach: '#FFE4D1',
  gold: '#F9C766',
  goldInk: '#9A6B12',
  lavender: '#E7DFF9',
  cream: '#F8EFE3',
  rose: '#FBE3E3',
  roseInk: '#B4474B',
  track: '#E3EAE5',

  shell: '#EEF1EA', // outside the phone-width shell on desktop
  shadow: 'rgba(39, 61, 53, 0.06)',
};

/** Dark variant keeps the same roles with calm, low-glare tints. */
const dark: typeof light = {
  canvas: '#121915',
  surface: '#1A241F',
  border: '#2A3832',
  ink: '#E6EFE9',
  muted: '#A2B4AA',
  faint: '#6F8279',

  forest: '#5FB088',
  forestBright: '#6FC497',
  onForest: '#0D1F16',
  mint: '#1F3A2C',
  sky: '#18333F',
  peach: '#3A2A20',
  gold: '#F9C766',
  goldInk: '#F2C76A',
  lavender: '#2B2640',
  cream: '#2D2820',
  rose: '#3D2224',
  roseInk: '#F08F92',
  track: '#2A3832',

  shell: '#0C110E',
  shadow: 'rgba(0, 0, 0, 0.3)',
};

export type Palette = typeof light;

export function useIsDark(): boolean {
  const system = useColorScheme();
  const pref = useStore((s) => s.snapshot.settings.theme);
  return pref === 'dark' || (pref !== 'light' && system === 'dark');
}

export function usePalette(): Palette {
  return useIsDark() ? dark : light;
}

/** Lato throughout (spec §02). Use families, not fontWeight, so web and native match. */
export const font = {
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
} as const;

/** 8 pt grid; card padding 16–24. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
/** Cards 16–24, hero cards up to 32, pills fully round. */
export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 } as const;
export const TOUCH = 44;
/** Mobile reference width 390; the desktop POC centres a phone-width shell. */
export const SHELL_WIDTH = 430;
export const TAB_BAR_SPACE = 100;

export function softShadow(p: Palette): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 2px 10px ${p.shadow}` } as ViewStyle,
    default: { shadowColor: '#273D35', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  })!;
}
