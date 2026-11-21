import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/** True when the OS asks for reduced motion (spec §12: reduced-motion alternative). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

export const nativeDriver = Platform.OS !== 'web';
