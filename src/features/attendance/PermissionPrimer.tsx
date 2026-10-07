import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Linking, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors } from '@/theme/colors';

import type { PermissionState } from './useCapturePermissions';
import { Text } from '@/components/ui/Text';

export const PERMISSION_MESSAGES = {
  cameraBlocked: 'Camera access was blocked. Open Settings, allow Camera for this app, then come back.',
  locationBlocked: 'Location access was blocked. Open Settings, allow Location for this app, then come back.',
} as const;

function PermissionRow({
  icon,
  title,
  why,
  state,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  why: string;
  state: PermissionState;
}) {
  const status = state === 'granted' ? 'Allowed' : state === 'blocked' ? 'Blocked' : 'Not allowed yet';
  return (
    <View className="flex-row items-start gap-3 py-2" accessible accessibilityLabel={`${title}: ${status}. ${why}`}>
      <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
        <Ionicons name={icon} size={20} color={colors.brand700} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-gray-900">{title}</Text>
        <Text className="text-sm leading-5 text-gray-600">{why}</Text>
      </View>
      {state === 'granted' ? (
        <Ionicons name="checkmark-circle" size={22} color={colors.brand600} />
      ) : state === 'blocked' ? (
        <Ionicons name="close-circle" size={22} color={colors.red600} />
      ) : null}
    </View>
  );
}

/**
 * Explains why the camera and location are needed before Android's permission dialogs appear,
 * and sends the student to Settings when a permission was denied for good.
 */
export function PermissionPrimer({
  camera,
  location,
  onRequest,
  requesting,
}: {
  camera: PermissionState;
  location: PermissionState;
  onRequest: () => void;
  requesting: boolean;
}) {
  const insets = useSafeAreaInsets();

  if (camera === 'checking' || location === 'checking') {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator color={colors.brand700} accessibilityLabel="Checking permissions" />
      </View>
    );
  }

  const canAsk = camera === 'ask' || location === 'ask';

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-1 gap-4 p-4">
        <Card
          title="Allow camera and location"
          description="Time in and time out require a live photo from your camera and your current location.">
          <PermissionRow
            icon="camera-outline"
            title="Camera"
            why="To take a live photo of you. Photos from your gallery can't be used."
            state={camera}
          />
          <PermissionRow
            icon="location-outline"
            title="Location"
            why="To record where you are when you submit, for your supervisor to verify."
            state={location}
          />
        </Card>
        {camera === 'blocked' ? <Banner message={PERMISSION_MESSAGES.cameraBlocked} /> : null}
        {location === 'blocked' ? <Banner message={PERMISSION_MESSAGES.locationBlocked} /> : null}
      </View>
      <View className="border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        {canAsk ? (
          <Button label="Continue" onPress={onRequest} loading={requesting} accessibilityHint="Shows the permission requests" />
        ) : (
          <Button label="Open Settings" icon="settings-outline" onPress={() => void Linking.openSettings()} />
        )}
      </View>
    </View>
  );
}
