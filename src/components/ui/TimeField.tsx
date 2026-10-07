import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { formatClock } from '@/lib/datetime';
import { colors } from '@/theme/colors';
import { Text } from './Text';

interface TimeFieldProps {
  label: string;
  /** "HH:mm" (24-hour, as the API takes it) or null */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  error?: string | null;
  disabled?: boolean;
}

function toPickerDate(value: string | null): Date {
  const date = new Date();
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  date.setHours(match ? Number(match[1]) : 8, match ? Number(match[2]) : 0, 0, 0);
  return date;
}

/**
 * A time input (the website's <input type="time">): label above, tap for Android's clock dialog
 * (12-hour), × to clear, red 422 error below. Shows "8:05 AM"; hands the API "08:05".
 */
export function TimeField({ label, value, onChange, placeholder = 'Not set', error, disabled = false }: TimeFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    setIosOpen(false);
    if (event.type === 'set' && date) {
      onChange(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
    }
  };

  const open = () => {
    if (disabled) return;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: toPickerDate(value), mode: 'time', is24Hour: false, onChange: handle });
    } else {
      setIosOpen(true);
    }
  };

  const shown = value ? formatClock(value) : placeholder;

  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <View
        className={`h-12 flex-row items-center rounded-xl border bg-white ${error ? 'border-red-500' : 'border-gray-300'} ${disabled ? 'opacity-60' : ''}`}>
        <Pressable
          onPress={open}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown}`}
          accessibilityHint="Opens a clock"
          accessibilityState={{ disabled }}
          className="h-full flex-1 flex-row items-center gap-2 pl-3">
          <Ionicons name="time-outline" size={18} color={colors.gray500} />
          <Text className={`flex-1 text-base ${value ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {shown}
          </Text>
        </Pressable>
        {value && !disabled ? (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            className="h-full w-11 items-center justify-center">
            <Ionicons name="close-circle" size={18} color={colors.gray400} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      {iosOpen ? <DateTimePicker value={toPickerDate(value)} mode="time" display="spinner" onChange={handle} /> : null}
    </View>
  );
}
