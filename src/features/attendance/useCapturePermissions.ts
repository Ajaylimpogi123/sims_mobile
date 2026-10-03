import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

export type PermissionState =
  /** Not known yet (first check running). */
  | 'checking'
  | 'granted'
  /** Not granted, but the system dialog can still be shown. */
  | 'ask'
  /** Denied with "don't ask again": only Settings can change it. */
  | 'blocked';

function stateOf(response: { granted: boolean; canAskAgain: boolean } | null): PermissionState {
  if (!response) return 'checking';
  if (response.granted) return 'granted';
  return response.canAskAgain ? 'ask' : 'blocked';
}

/**
 * Camera + foreground location permission for the attendance capture screen.
 * Re-checks when the app returns to the foreground (the student may have changed them in Settings).
 */
export function useCapturePermissions() {
  const [cameraResponse, requestCamera, getCamera] = useCameraPermissions();
  const [locationResponse, setLocationResponse] = useState<Location.LocationPermissionResponse | null>(null);

  const refresh = useCallback(async () => {
    const [, location] = await Promise.all([getCamera(), Location.getForegroundPermissionsAsync()]);
    setLocationResponse(location);
  }, [getCamera]);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  /** Shows the system dialogs for whatever can still be asked (camera first, then location). */
  const request = useCallback(async () => {
    if (cameraResponse && !cameraResponse.granted && cameraResponse.canAskAgain) await requestCamera();
    if (!locationResponse || (!locationResponse.granted && locationResponse.canAskAgain)) {
      setLocationResponse(await Location.requestForegroundPermissionsAsync());
    }
  }, [cameraResponse, locationResponse, requestCamera]);

  const camera = stateOf(cameraResponse);
  const location = stateOf(locationResponse);

  return {
    camera,
    location,
    /** Android "Approximate location" only: fixes can be kilometres off. */
    approximateOnly: location === 'granted' && locationResponse?.android?.accuracy === 'coarse',
    allGranted: camera === 'granted' && location === 'granted',
    request,
  };
}
