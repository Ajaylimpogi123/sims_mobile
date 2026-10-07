import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { ActivityIndicator, Linking, Platform, Pressable, View } from 'react-native';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { formatAccuracy, formatCoordinates, openInMaps } from './photo';
import { POOR_ACCURACY_M, type LocationFixState } from './useLocationFix';
import { Text } from '@/components/ui/Text';

const MESSAGES = {
  off: 'Location is turned off on this phone. Turn on Location, then press Try again.',
  approximate:
    'This app only has your approximate location, which can be far off. In Settings, turn on "Use precise location" for this app.',
} as const;

function poorAccuracyMessage(accuracy: number): string {
  return `Your location is only accurate to ±${Math.round(accuracy)} m. Move near a window or outdoors, then press Refresh for a better reading.`;
}

/** Android shows Google's "Turn on location" dialog; if that isn't available, open the Location settings page. */
async function turnOnLocation(onEnabled: () => void) {
  try {
    await Location.enableNetworkProviderAsync();
    onEnabled();
  } catch {
    if (Platform.OS === 'android') {
      Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => void Linking.openSettings());
    } else {
      void Linking.openSettings();
    }
  }
}

/** The website's "Location" block of the capture dialog: coordinates, accuracy, View map, Refresh. */
export function LocationPanel({
  state,
  onRetry,
  approximateOnly,
  disabled,
  fieldErrors,
}: {
  state: LocationFixState;
  onRetry: () => void;
  approximateOnly: boolean;
  disabled: boolean;
  fieldErrors: string[];
}) {
  const fix = state.status === 'ready' ? state.fix : null;
  const locating = state.status === 'locating' || state.status === 'idle';
  const best = state.status === 'locating' ? state.best : null;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-gray-700">Location</Text>
      <View className="min-h-16 flex-row items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <Ionicons name="location-outline" size={20} color={colors.gray500} />
        <View className="flex-1 gap-0.5" accessibilityLiveRegion="polite">
          {fix ? (
            <>
              <Text className="text-base font-medium text-gray-900" style={TABULAR}>
                {formatCoordinates(fix.latitude, fix.longitude)}
              </Text>
              <View className="flex-row flex-wrap items-center">
                <Text className="text-sm text-gray-600" style={TABULAR}>
                  {formatAccuracy(fix.accuracy)} ·{' '}
                </Text>
                <Pressable
                  onPress={() => openInMaps(fix.latitude, fix.longitude)}
                  accessibilityRole="link"
                  accessibilityHint="Opens Google Maps"
                  hitSlop={10}>
                  <Text className="text-sm font-medium text-brand-700 underline">View map</Text>
                </Pressable>
              </View>
            </>
          ) : locating ? (
            <View className="flex-row items-center gap-2">
              <ActivityIndicator size="small" color={colors.gray500} />
              <Text className="flex-1 text-sm text-gray-600" style={TABULAR}>
                {best?.accuracy != null
                  ? `Getting your location… (±${Math.round(best.accuracy)} m so far)`
                  : 'Getting your location…'}
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-gray-600">{state.status === 'off' ? 'Location is off' : 'Location unavailable'}</Text>
          )}
        </View>
        {fix || state.status === 'error' ? (
          <Pressable
            onPress={onRetry}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={fix ? 'Refresh location' : 'Try again'}
            accessibilityState={{ disabled }}
            className={`min-h-11 flex-row items-center gap-1.5 rounded-md border border-gray-300 px-3 active:bg-gray-50 ${disabled ? 'opacity-50' : ''}`}>
            <Ionicons name="refresh" size={16} color={colors.gray900} />
            <Text className="text-sm font-medium text-gray-900">{fix ? 'Refresh' : 'Try again'}</Text>
          </Pressable>
        ) : null}
      </View>

      {state.status === 'off' ? (
        <View className="gap-2">
          <Banner tone="warning" message={MESSAGES.off} />
          <View className="flex-row gap-2">
            <Button
              label="Turn on Location"
              icon="navigate-outline"
              variant="outline"
              className="flex-1"
              onPress={() => void turnOnLocation(onRetry)}
            />
            <Button label="Try again" variant="outline" className="flex-1" onPress={onRetry} />
          </View>
        </View>
      ) : null}
      {state.status === 'error' ? <Banner message={state.message} /> : null}
      {approximateOnly ? (
        <View className="gap-2">
          <Banner tone="warning" message={MESSAGES.approximate} />
          <Button label="Open Settings" icon="settings-outline" variant="outline" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {fix && fix.accuracy !== null && fix.accuracy > POOR_ACCURACY_M && !approximateOnly ? (
        <Banner tone="warning" message={poorAccuracyMessage(fix.accuracy)} />
      ) : null}
      {fieldErrors.map((message) => (
        <Text key={message} className="text-sm text-red-600">
          {message}
        </Text>
      ))}
    </View>
  );
}
