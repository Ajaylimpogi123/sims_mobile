import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';

interface SearchFieldProps {
  /** Website placeholder, e.g. "Filter by student name..." */
  placeholder: string;
  /** Called with the trimmed text after typing pauses (debounced), and at once on clear. */
  onSearch: (value: string) => void;
  initialValue?: string;
  delayMs?: number;
  /** Server limit for the search text, if any. */
  maxLength?: number;
}

/** The website's table filter input: search icon, × to clear, debounced so each keystroke isn't a request. */
export function SearchField({ placeholder, onSearch, initialValue = '', delayMs = 350, maxLength }: SearchFieldProps) {
  const [text, setText] = useState(initialValue);
  const callback = useRef(onSearch);
  callback.current = onSearch;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => callback.current(text.trim()), delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs]);

  return (
    <View className="h-12 flex-row items-center rounded-xl border border-gray-300 bg-white pl-3">
      <Ionicons name="search-outline" size={18} color={colors.gray500} />
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={colors.gray400}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        onSubmitEditing={() => callback.current(text.trim())}
        autoCorrect={false}
        className="h-full flex-1 px-2 text-base text-gray-900"
      />
      {text ? (
        <Pressable
          onPress={() => {
            setText('');
            callback.current('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          className="h-full w-11 items-center justify-center">
          <Ionicons name="close-circle" size={18} color={colors.gray400} />
        </Pressable>
      ) : null}
    </View>
  );
}
