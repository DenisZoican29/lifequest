import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { Coin } from './art';
import { CelebrationCard, type Celebration } from './celebration';
import { Ionicons } from './components';
import { font, radius, softShadow, space, usePalette } from './theme';

type Tone = 'success' | 'error' | 'coin';
type Notice = { kind: 'toast'; message: string; tone: Tone } | Celebration;
interface ToastState {
  notice?: Notice;
  id: number;
  show(notice: Notice): void;
  hide(): void;
}

const useToast = create<ToastState>((set) => ({
  id: 0,
  show: (notice) => set((s) => ({ notice, id: s.id + 1 })),
  hide: () => set({ notice: undefined }),
}));

export const toast = (message: string, tone: Tone = 'success') => useToast.getState().show({ kind: 'toast', message, tone });
export const celebrate = (notice: Celebration) => useToast.getState().show(notice);

/** Feedback stays mounted above the routes so it can survive a successful save and navigation. */
export function ToastHost() {
  const { top } = useSafeAreaInsets();
  const { notice, id, hide } = useToast();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(hide, notice.kind === 'toast' ? 2600 : 3200);
    return () => clearTimeout(timer);
  }, [id, notice, hide]);

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: top + space.xl }]} accessibilityLiveRegion="polite">
      {notice?.kind === 'toast' && <BasicToast message={notice.message} tone={notice.tone} />}
      {notice && notice.kind !== 'toast' && <CelebrationCard key={id} {...notice} />}
    </View>
  );
}

function BasicToast({ message, tone }: { message: string; tone: Tone }) {
  const p = usePalette();
  const c = {
    success: { bg: p.mint, fg: p.forest },
    error: { bg: p.rose, fg: p.roseInk },
    coin: { bg: p.cream, fg: p.ink },
  }[tone];
  return (
    <View style={[styles.toast, { backgroundColor: c.bg, borderColor: p.border }, softShadow(p)]}>
      {tone === 'coin' ? <Coin size={20} /> : <Ionicons name={tone === 'error' ? 'information-circle' : 'checkmark-circle'} size={19} color={c.fg} aria-hidden />}
      <Text style={{ color: c.fg, fontFamily: font.bold, fontSize: 15, flexShrink: 1 }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, borderWidth: 1, maxWidth: 400 },
});
