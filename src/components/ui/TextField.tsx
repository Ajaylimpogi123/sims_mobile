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
  // multiline = the website's <textarea>: about three lines tall, text starts at the top.
  const multiline = !!inputProps.multiline;
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <View
        className={`flex-row rounded-xl border bg-white px-3 ${multiline ? 'min-h-24 items-start py-2' : 'h-12 items-center'} ${error ? 'border-red-500' : 'border-gray-300'}`}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.gray400}
          textAlignVertical={multiline ? 'top' : undefined}
          className={`flex-1 text-base text-gray-900 ${multiline ? 'min-h-20' : ''}`}
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
