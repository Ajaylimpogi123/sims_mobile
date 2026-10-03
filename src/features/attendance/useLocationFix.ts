import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LocationFix {
  latitude: number;
  longitude: number;
  /** metres, null when the phone didn't report it */
  accuracy: number | null;
  /** Android's fake-GPS flag: true if any reading in this attempt was mocked; null when the OS doesn't report it. */
  mocked: boolean | null;
}

export type LocationFixState =
  | { status: 'idle' }
  | { status: 'locating'; best: LocationFix | null }
  /** Location (GPS) is switched off on the phone. */
  | { status: 'off' }
  | { status: 'ready'; fix: LocationFix }
  | { status: 'error'; message: string };

/** Stop early once a reading is this good. */
const GOOD_ACCURACY_M = 20;
/** Give up waiting for a better reading after this long (the website waits 15 s too). */
const TIMEOUT_MS = 15_000;
/** Above this, the screen warns that the reading is poor (it can still be submitted; the server decides). */
export const POOR_ACCURACY_M = 100;

export const LOCATION_MESSAGES = {
  timeout: 'Getting your location took too long. Move near a window or outdoors, then press Try again.',
  unavailable: "Your location couldn't be determined. Make sure Location is turned on, then press Try again.",
} as const;

function isBetter(candidate: LocationFix, current: LocationFix | null): boolean {
  if (!current) return true;
  if (candidate.accuracy === null) return false;
  return current.accuracy === null || candidate.accuracy < current.accuracy;
}

/**
 * One high-accuracy location fix. Watches the GPS for up to 15 s and keeps the most accurate
 * reading, finishing early at ±20 m. Call start() to (re)acquire; late readings from an
 * earlier attempt or after unmount are ignored.
 */
export function useLocationFix() {
  const [state, setState] = useState<LocationFixState>({ status: 'idle' });
  const attempt = useRef(0);
  const subscription = useRef<Location.LocationSubscription | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    subscription.current?.remove();
    subscription.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const start = useCallback(async () => {
    const id = ++attempt.current;
    cleanup();
    setState({ status: 'locating', best: null });

    let servicesOn = true;
    try {
      servicesOn = await Location.hasServicesEnabledAsync();
    } catch {
      // Unknown: try anyway, the watch reports its own error.
    }
    if (id !== attempt.current) return;
    if (!servicesOn) {
      setState({ status: 'off' });
      return;
    }

    let best: LocationFix | null = null;
    let reported = false;
    let anyMocked = false;

    const finish = () => {
      if (id !== attempt.current) return;
      cleanup();
      if (!best) {
        setState({ status: 'error', message: LOCATION_MESSAGES.timeout });
        return;
      }
      setState({ status: 'ready', fix: { ...best, mocked: reported ? anyMocked : null } });
    };

    timer.current = setTimeout(finish, TIMEOUT_MS);

    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: true },
        (location) => {
          if (id !== attempt.current) return;
          if (typeof location.mocked === 'boolean') {
            reported = true;
            anyMocked = anyMocked || location.mocked;
          }
          const accuracy = location.coords.accuracy;
          const reading: LocationFix = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: accuracy !== null && Number.isFinite(accuracy) ? accuracy : null,
            mocked: null,
          };
          if (isBetter(reading, best)) best = reading;
          if (best && best.accuracy !== null && best.accuracy <= GOOD_ACCURACY_M) {
            finish();
          } else {
            setState({ status: 'locating', best });
          }
        },
        () => {
          if (id !== attempt.current) return;
          cleanup();
          setState({ status: 'error', message: LOCATION_MESSAGES.unavailable });
        },
      );
      if (id !== attempt.current) {
        sub.remove();
        return;
      }
      subscription.current = sub;
    } catch {
      if (id !== attempt.current) return;
      cleanup();
      // Most often Location was switched off between the check and the watch.
      const on = await Location.hasServicesEnabledAsync().catch(() => true);
      if (id !== attempt.current) return;
      setState(on ? { status: 'error', message: LOCATION_MESSAGES.unavailable } : { status: 'off' });
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    attempt.current += 1;
    cleanup();
  }, [cleanup]);

  useEffect(
    () => () => {
      attempt.current += 1;
      cleanup();
    },
    [cleanup],
  );

  return { state, start, stop };
}
