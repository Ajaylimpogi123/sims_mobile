import { forwardRef, type ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors } from '@/theme/colors';

interface TextFieldProps extends Omit<TextInputProps, 'className'> {
  label: string;
  /** Field error (e.g. a 422 `errors[field][0]`), shown under the input. */
  error?: string | null;
  /** Element rendered inside the input on the right, e.g. a show/hide toggle. */
  right?: ReactNode;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField({ label, error, right, ...inputProps }, ref) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-slate-700">{label}</Text>
      <View
        className={`h-12 flex-row items-center rounded-xl border bg-white px-3 ${error ? 'border-red-500' : 'border-slate-300'}`}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.slate400}
          className="flex-1 text-base text-slate-900"
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          {...inputProps}
        />
        {right}
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
});
