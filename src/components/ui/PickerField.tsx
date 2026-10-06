import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/theme/colors';

interface PickerFieldProps {
  label: string;
  /** Selected option's text, or null to show the placeholder. */
  value: string | null;
  placeholder: string;
  /** Muted line under the value, e.g. a slot count. */
  detail?: string | null;
  onPress: () => void;
  disabled?: boolean;
  /** Field error (e.g. a 422 `errors[field][0]`), shown under the field. */
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
}

/** The trigger of a <select> (the website's SelectTrigger): label above, opens a SelectSheet, 422 error below. */
export function PickerField({ label, value, placeholder, detail, onPress, disabled = false, error, icon }: PickerFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityState={{ disabled }}
        accessibilityHint={error ?? undefined}
        className={`min-h-12 flex-row items-center gap-2 rounded-xl border px-3 py-2 ${error ? 'border-red-500' : 'border-gray-300'} ${
          disabled ? 'bg-gray-100' : 'bg-white active:bg-gray-50'
        }`}>
        {icon ? <Ionicons name={icon} size={18} color={colors.gray500} /> : null}
        <View className="flex-1">
          <Text className={`text-base ${value && !disabled ? 'text-gray-900' : 'text-gray-400'}`} numberOfLines={1}>
            {value ?? placeholder}
          </Text>
          {detail ? (
            <Text className="text-xs text-gray-500" numberOfLines={1}>
              {detail}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-down" size={18} color={disabled ? colors.gray400 : colors.gray500} />
      </Pressable>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
