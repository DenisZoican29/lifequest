import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { create } from 'zustand';

import { Coin } from './art';
import { Ionicons } from './components';
import { font, radius, softShadow, space, usePalette } from './theme';

type Tone = 'success' | 'error' | 'coin';
interface ToastState {
  message?: string;
  tone: Tone;
  id: number;
  show(message: string, tone?: Tone): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  tone: 'success',
  id: 0,
  show: (message, tone = 'success') => set((s) => ({ message, tone, id: s.id + 1 })),
  hide: () => set({ message: undefined }),
}));

export const toast = (message: string, tone?: Tone) => useToast.getState().show(message, tone);

/** Small, non-blocking feedback; never a forced full-screen celebration (spec §07). */
export function ToastHost() {
  const p = usePalette();
  const { message, tone, id, hide } = useToast();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, 2600);
    return () => clearTimeout(t);
  }, [id, message, hide]);
  if (!message) return null;
  const c = {
    success: { bg: p.mint, fg: p.forest },
    error: { bg: p.rose, fg: p.roseInk },
    coin: { bg: p.cream, fg: p.ink },
  }[tone];
  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={[styles.toast, { backgroundColor: c.bg, borderColor: p.border }, softShadow(p)]}>
        {tone === 'coin' ? <Coin size={20} /> : <Ionicons name={tone === 'error' ? 'information-circle' : 'checkmark-circle'} size={19} color={c.fg} />}
        <Text style={{ color: c.fg, fontFamily: font.bold, fontSize: 15, flexShrink: 1 }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: space.xl, left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, borderWidth: 1, maxWidth: 400 },
});
