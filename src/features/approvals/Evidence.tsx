import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import type { ApprovalItem, AttendanceLeg } from '@/api/types';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { openInMaps } from '../attendance/photo';

import { isEmergencyLeg, legLabel } from './format';

/**
 * Website: MockedLocationBadge. Shown only when the phone reported a mocked location
 * (`*_mocked === true`); false / null (every web submission) shows nothing.
 */
export function MockedLocationBadge() {
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full bg-amber-100 px-2 py-0.5"
      accessible
      accessibilityLabel="Possible fake GPS. The phone reported a mocked location for this entry.">
      <Ionicons name="warning-outline" size={12} color={colors.amber700} />
      <Text className="text-xs font-medium text-amber-700">Possible fake GPS</Text>
    </View>
  );
}

/** Leg name; an emergency time-out is the website's red pill. */
export function LegLabel({ item, leg }: { item: ApprovalItem; leg: AttendanceLeg }) {
  const label = legLabel(item, leg);
  if (isEmergencyLeg(item, leg)) {
    return (
      <View className="self-start rounded-full bg-red-100 px-2 py-0.5">
        <Text className="text-xs font-medium text-red-700">{label}</Text>
      </View>
    );
  }
  return <Text className="text-xs font-medium text-gray-500">{label}</Text>;
}

export function legLocation(item: ApprovalItem, leg: AttendanceLeg) {
  const latitude = item[`${leg}_latitude`];
  const longitude = item[`${leg}_longitude`];
  return {
    latitude,
    longitude,
    accuracy: item[`${leg}_accuracy`],
    hasLocation: latitude !== null && longitude !== null,
    mocked: item[`${leg}_mocked`] === true,
  };
}

/** Website's "View map" link with "±12 m" under it, or "No location". */
export function MapLink({ item, leg }: { item: ApprovalItem; leg: AttendanceLeg }) {
  const { latitude, longitude, accuracy, hasLocation } = legLocation(item, leg);
  if (!hasLocation || latitude === null || longitude === null) {
    return <Text className="text-xs text-gray-500">No location</Text>;
  }
  return (
    <Pressable
      onPress={() => openInMaps(latitude, longitude)}
      accessibilityRole="link"
      accessibilityLabel={`View ${legLabel(item, leg)} location on the map${accuracy !== null ? `, accurate to ${Math.round(accuracy)} metres` : ''}`}
      accessibilityHint="Opens Google Maps"
      className="min-h-11 items-end justify-center rounded-lg px-1 active:bg-brand-50">
      <View className="flex-row items-center gap-1">
        <Ionicons name="location-outline" size={14} color={colors.brand700} />
        <Text className="text-sm font-medium text-brand-700 underline">View map</Text>
      </View>
      {accuracy !== null ? (
        <Text className="text-xs text-gray-500" style={TABULAR}>
          ±{Math.round(accuracy)} m
        </Text>
      ) : null}
    </Pressable>
  );
}
