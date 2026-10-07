import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';

/** Loading placeholder that pulses (holds still when the phone's Reduce Motion is on). */
export function SkeletonPulse({ children, label }: { children: ReactNode; label: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View style={{ opacity }} accessible accessibilityLabel={label} accessibilityState={{ busy: true }}>
      {children}
    </Animated.View>
  );
}

/** A grey block; size it with className (e.g. "h-4 w-1/2"). */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <View className={`rounded-md bg-gray-200 ${className}`} />;
}
