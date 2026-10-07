import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAvailableSupervisors } from '@/api/companies';
import { toApiError } from '@/api/errors';
import type { AvailableSupervisor } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { colors } from '@/theme/colors';
import { Text, TextInput } from '@/components/ui/Text';

const SEARCH_FROM = 8;

interface Props {
  visible: boolean;
  companyId: number;
  /** Ids already on the roster, hidden even if the available list is a moment old. */
  rosterIds: ReadonlySet<number>;
  onPick: (supervisor: AvailableSupervisor) => void;
  onClose: () => void;
}

/**
 * The website roster modal's "Add Supervisor" <select>: Supervisor accounts not yet on this
 * company's roster, fetched fresh each time it opens. Inactive accounts are listed (as on the
 * website) with their badge.
 */
export function SupervisorPickerSheet({ visible, companyId, rosterIds, onPick, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const available = useAvailableSupervisors(companyId, visible);

  const options = useMemo(() => (available.data ?? []).filter((s) => !rosterIds.has(s.id)), [available.data, rosterIds]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setQuery('');
    onClose();
  };

  let empty;
  if (available.isPending) {
    empty = (
      <View className="py-8">
        <ActivityIndicator color={colors.brand700} accessibilityLabel="Loading supervisors" />
      </View>
    );
  } else if (available.isError) {
    empty = (
      <View className="items-center gap-3 px-4 py-6">
        <Text className="text-center text-sm text-gray-600">{toApiError(available.error).message}</Text>
        <Button label="Try again" variant="outline" onPress={() => void available.refetch()} loading={available.isFetching} />
      </View>
    );
  } else if (options.length === 0) {
    // Website select's empty text.
    empty = <Text className="px-4 py-6 text-center text-sm text-gray-500">No more supervisors available</Text>;
  } else {
    empty = <Text className="px-4 py-6 text-center text-sm text-gray-500">No matches.</Text>;
  }

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
              Add Supervisor
            </Text>
            <Pressable
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100">
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
                accessibilityLabel="Search supervisors"
                className="flex-1 text-base text-gray-900"
                autoCorrect={false}
              />
            </View>
          ) : null}
          <FlatList
            data={available.isPending || available.isError ? [] : rows}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setQuery('');
                  onPick(item);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.email}${item.status === 'inactive' ? ', Inactive' : ''}`}
                accessibilityHint="Adds this supervisor to the roster"
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                className="min-h-12 flex-row items-center gap-3 px-4 py-3">
                <View className="flex-1">
                  <Text className="text-base text-gray-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-gray-500" numberOfLines={1}>
                    {item.email}
                  </Text>
                </View>
                {item.status === 'inactive' ? <StatusBadge status="inactive" /> : null}
                <Ionicons name="add-circle-outline" size={22} color={colors.brand700} />
              </Pressable>
            )}
            ListEmptyComponent={empty}
          />
        </View>
      </View>
    </Modal>
  );
}
