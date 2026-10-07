import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { AttendanceLeg, AttendanceRecord } from '@/api/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatTime } from '@/lib/datetime';
import { formatNumber, TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { MockedLocationBadge } from '../approvals/Evidence';

import { AttendancePhoto } from './AttendancePhoto';
import { openInMaps } from './photo';
import { Text } from '@/components/ui/Text';

const LEG_LABEL: Record<AttendanceLeg, string> = { time_in: 'Time In', time_out: 'Time Out' };

/** One leg: photo, time, "View map ±12 m" (or "No location") and its status. */
function DayLeg({ record, leg, showMocked }: { record: AttendanceRecord; leg: AttendanceLeg; showMocked: boolean }) {
  const time = record[leg];
  const status = record[`${leg}_status`];
  const latitude = record[`${leg}_latitude`];
  const longitude = record[`${leg}_longitude`];
  const accuracy = record[`${leg}_accuracy`];
  const hasLocation = latitude !== null && longitude !== null;
  const mocked = showMocked && record[`${leg}_mocked`] === true;

  return (
    <View className="gap-1.5 py-2">
      <View className="flex-row items-center gap-3">
        {time ? (
          <AttendancePhoto url={record[`${leg}_photo_url`]} label={`${LEG_LABEL[leg]} photo, ${formatDate(record.date)}`} />
        ) : (
          <View className="h-12 w-12" />
        )}
        <View className="flex-1 gap-0.5">
          <Text className="text-xs text-gray-500">{LEG_LABEL[leg]}</Text>
          <Text className={`text-base ${time ? 'font-medium text-gray-900' : 'text-gray-500'}`} style={TABULAR}>
            {time ? formatTime(time) : '-'}
          </Text>
        </View>
        {hasLocation ? (
          <Pressable
            onPress={() => openInMaps(latitude, longitude)}
            accessibilityRole="link"
            accessibilityLabel={`View ${LEG_LABEL[leg]} location on the map${accuracy !== null ? `, accurate to ${Math.round(accuracy)} metres` : ''}`}
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
        ) : time ? (
          <Text className="text-xs text-gray-500">No location</Text>
        ) : null}
        <View className="w-20 items-end">{status ? <StatusBadge status={status} /> : null}</View>
      </View>
      {mocked ? (
        <View className="ml-[60px]">
          <MockedLocationBadge />
        </View>
      ) : null}
    </View>
  );
}

interface AttendanceDayCardProps {
  record: AttendanceRecord;
  /** Reviewer view (Attendance Monitoring): shows the "Possible fake GPS" badge. Students never see it. */
  showMocked?: boolean;
  /** Extra line in the header, e.g. "Recorded by Staff". */
  meta?: string;
  /** Amber outline while a notification / link points at this record. */
  highlighted?: boolean;
  /** Actions under the record (Edit / Delete). */
  children?: ReactNode;
}

/** One attendance day (website: one attendance table row) as a card: date, hours, In and Out legs with evidence. */
export function AttendanceDayCard({ record, showMocked = false, meta, highlighted = false, children }: AttendanceDayCardProps) {
  return (
    <View className={`mx-4 mb-3 rounded-2xl border p-4 ${highlighted ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <View className="mb-1 flex-row items-center gap-2">
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-gray-900">{formatDate(record.date)}</Text>
          {meta ? <Text className="text-xs text-gray-500">{meta}</Text> : null}
        </View>
        {record.is_emergency ? (
          <View className="rounded-full bg-red-100 px-2 py-0.5">
            <Text className="text-xs font-medium text-red-700">Emergency</Text>
          </View>
        ) : null}
        <Text className="text-sm text-gray-600" style={TABULAR}>
          {record.rendered_hours !== null ? `${formatNumber(record.rendered_hours)} hrs` : '-'}
        </Text>
      </View>
      <DayLeg record={record} leg="time_in" showMocked={showMocked} />
      <View className="h-px bg-gray-100" />
      <DayLeg record={record} leg="time_out" showMocked={showMocked} />
      {record.time_in_status === 'rejected' && record.time_in_rejection_reason ? (
        <Text className="mt-1 text-sm text-red-600">Time-in rejected: {record.time_in_rejection_reason}</Text>
      ) : null}
      {record.time_out_status === 'rejected' && record.time_out_rejection_reason ? (
        <Text className="mt-1 text-sm text-red-600">Time-out rejected: {record.time_out_rejection_reason}</Text>
      ) : null}
      {record.is_emergency && record.note ? (
        <Text className="mt-1 text-sm text-gray-600" numberOfLines={4}>
          Emergency: {record.note}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
