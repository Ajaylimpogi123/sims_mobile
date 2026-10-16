import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { PickerField } from '@/components/ui/PickerField';
import { SelectSheet, type SelectOption } from '@/components/ui/SelectSheet';
import { Text } from '@/components/ui/Text';
import { termStatusLabel } from '@/terms/selected-term';
import { useTermScope } from '@/terms/useTermScope';
import { colors } from '@/theme/colors';

/**
 * The website's header term picker (TermSwitcher.jsx) for Supervisors, Coordinators and Admins:
 * which term the lists, counts and charts show. The current term is marked "Current".
 * Renders nothing for students or when there are no terms.
 */
export function TermPicker() {
  const scope = useTermScope();
  const [open, setOpen] = useState(false);

  if (!scope.enabled || (scope.terms.length === 0 && !scope.current)) return null;

  const options: SelectOption[] = scope.terms.map((term) => ({
    value: term.id,
    label: term.label,
    meta: termStatusLabel(term),
  }));
  const selected = scope.selected;
  const label = selected ? `${selected.label} (${termStatusLabel(selected)})` : null;

  return (
    <>
      <PickerField
        label="Term"
        icon="calendar-outline"
        value={label}
        placeholder="Select term"
        onPress={() => setOpen(true)}
        disabled={scope.termsLoading && scope.terms.length === 0}
      />
      <SelectSheet
        visible={open}
        title="School term"
        options={options}
        selected={selected?.id ?? null}
        onSelect={(value) => scope.select(value)}
        onClose={() => setOpen(false)}
        emptyText="No terms yet"
      />
    </>
  );
}

/**
 * The website's ArchivedTermBanner: an amber notice while a past (archived) term is viewed, with
 * "Back to current term". Upcoming terms are open, so no banner. Administrators are told they can
 * still make changes; everyone else that it's read-only.
 */
export function ArchivedTermBanner() {
  const scope = useTermScope();
  if (!scope.archived) return null;
  const label = scope.selected ? ` (${scope.selected.label})` : '';

  return (
    <View accessibilityRole="alert" className="gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <View className="flex-row items-start gap-2">
        <Ionicons name="archive-outline" size={18} color={colors.amber600} />
        <Text className="flex-1 text-sm leading-5 text-amber-900">
          You&apos;re viewing an archived term{label}.{' '}
          {scope.isAdmin ? 'As an Administrator, you can still make changes.' : 'It’s read-only.'}
        </Text>
      </View>
      {scope.current ? (
        <Pressable
          onPress={() => scope.select(null)}
          accessibilityRole="button"
          className="min-h-10 self-start justify-center rounded-md border border-amber-300 bg-white px-3 active:bg-amber-100">
          <Text className="text-sm font-medium text-amber-900">Back to current term</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Picker + archived banner, for the top of Home and the Students screens. */
export function TermBar() {
  const scope = useTermScope();
  if (!scope.enabled) return null;
  return (
    <View className="gap-3">
      <TermPicker />
      <ArchivedTermBanner />
    </View>
  );
}
