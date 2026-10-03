import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

export interface SelectOption {
  value: number;
  label: string;
  /** Extra text that search also matches (e.g. a student number). */
  hint?: string;
}

interface SelectSheetProps {
  visible: boolean;
  title: string;
  /** First row, meaning "no filter", e.g. "All Companies" (the website's empty <option>). */
  allLabel: string;
  options: SelectOption[];
  selected: number | null;
  onSelect: (value: number | null) => void;
  onClose: () => void;
}

const SEARCH_FROM = 8;

/** Bottom sheet list picker (the website's <select>), with search when the list is long. */
export function SelectSheet({ visible, title, allLabel, options, selected, onSelect, onClose }: SelectSheetProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q))
      : options;
    return [{ value: null, label: allLabel } as { value: number | null; label: string; hint?: string }, ...matches];
  }, [allLabel, options, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/40" onPress={close} accessibilityRole="button" accessibilityLabel="Close" />
        <View className="max-h-[75%] rounded-t-2xl bg-white" style={{ paddingBottom: insets.bottom + 8 }}>
          <View className="items-center pt-2">
            <View className="h-1 w-10 rounded-full bg-gray-300" />
          </View>
          <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
            <Text accessibilityRole="header" className="text-base font-semibold text-gray-900">
              {title}
            </Text>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
              <Ionicons name="close" size={22} color={colors.gray500} />
            </Pressable>
          </View>
          {options.length >= SEARCH_FROM ? (
            <View className="mx-4 mb-2 h-11 flex-row items-center gap-2 rounded-xl border border-gray-300 px-3">
              <Ionicons name="search" size={18} color={colors.gray400} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={colors.gray400}
                accessibilityLabel={`Search ${title.toLowerCase()}`}
                className="flex-1 text-base text-gray-900"
                autoCorrect={false}
              />
            </View>
          ) : null}
          <FlatList
            data={rows}
            keyExtractor={(item) => String(item.value ?? 'all')}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.value === selected;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    close();
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                  className="min-h-12 flex-row items-center gap-3 px-4 py-3">
                  <View className="flex-1">
                    <Text className={`text-base ${isSelected ? 'font-medium text-brand-700' : 'text-gray-900'}`}>{item.label}</Text>
                    {item.hint ? <Text className="text-xs text-gray-500">{item.hint}</Text> : null}
                  </View>
                  {isSelected ? <Ionicons name="checkmark" size={20} color={colors.brand700} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={<Text className="px-4 py-6 text-center text-sm text-gray-500">No matches.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}
