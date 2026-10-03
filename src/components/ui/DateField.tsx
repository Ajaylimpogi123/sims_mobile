import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { formatDate, fromApiDate, toApiDate } from '@/lib/datetime';
import { colors } from '@/theme/colors';

interface DateFieldProps {
  label: string;
  /** "YYYY-MM-DD" or null */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  minimumDate?: string | null;
  maximumDate?: string | null;
  error?: string | null;
  /** Show the × clear button (off for required dates). Default true. */
  clearable?: boolean;
}

/** A date input: label above, tap to pick (Android's calendar dialog), × to clear, red 422 error below. */
export function DateField({ label, value, onChange, placeholder = 'Any date', minimumDate, maximumDate, error, clearable = true }: DateFieldProps) {
  const [iosOpen, setIosOpen] = useState(false);
  const current = value ? fromApiDate(value) : maximumDate ? fromApiDate(maximumDate) : new Date();
  const min = minimumDate ? fromApiDate(minimumDate) : undefined;
  const max = maximumDate ? fromApiDate(maximumDate) : undefined;

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    setIosOpen(false);
    if (event.type === 'set' && date) onChange(toApiDate(date));
  };

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: current, mode: 'date', minimumDate: min, maximumDate: max, onChange: handle });
    } else {
      setIosOpen(true);
    }
  };

  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <View className={`h-12 flex-row items-center rounded-xl border bg-white ${error ? 'border-red-500' : 'border-gray-300'}`}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? formatDate(value) : placeholder}`}
          accessibilityHint="Opens a calendar"
          className="h-full flex-1 flex-row items-center gap-2 pl-3">
          <Ionicons name="calendar-outline" size={18} color={colors.gray500} />
          <Text className={`flex-1 text-base ${value ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
            {value ? formatDate(value) : placeholder}
          </Text>
        </Pressable>
        {value && clearable ? (
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
      {iosOpen ? (
        <DateTimePicker value={current} mode="date" display="inline" minimumDate={min} maximumDate={max} onChange={handle} />
      ) : null}
    </View>
  );
}
