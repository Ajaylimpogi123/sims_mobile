import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { AnalyticsFilterOptions, AnalyticsFilters } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { DateField } from '@/components/ui/DateField';
import { SelectSheet, type SelectOption } from '@/components/ui/SelectSheet';
import { todayApiDate } from '@/lib/datetime';
import { colors } from '@/theme/colors';
import { Text } from '@/components/ui/Text';

type SelectKey = 'company_id' | 'supervisor_id' | 'student_id';

interface FilterBarProps {
  filters: AnalyticsFilters;
  onChange: (next: AnalyticsFilters) => void;
  options: AnalyticsFilterOptions | undefined;
  /** The website hides the Supervisor filter for supervisors (they only see their own students). */
  showSupervisor: boolean;
  /** 422 field errors from the API, keyed by query field name. */
  errors: Record<string, string>;
}

/** Same filters as the website's FilterBar: Date Range, Company, Supervisor, Student, Clear Filters. */
export function FilterBar({ filters, onChange, options, showSupervisor, errors }: FilterBarProps) {
  const [open, setOpen] = useState<SelectKey | null>(null);
  const today = todayApiDate();

  const lists: Record<SelectKey, { title: string; all: string; options: SelectOption[] }> = {
    company_id: {
      title: 'Company',
      all: 'All Companies',
      options: (options?.companies ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    supervisor_id: {
      title: 'Supervisor',
      all: 'All Supervisors',
      options: (options?.supervisors ?? []).map((s) => ({ value: s.id, label: s.name })),
    },
    student_id: {
      title: 'Student',
      all: 'All Students',
      options: (options?.students ?? []).map((s) => ({
        value: s.id,
        label: s.name ?? s.student_number,
        hint: s.name ? s.student_number : undefined,
      })),
    },
  };
  const keys: SelectKey[] = showSupervisor ? ['company_id', 'supervisor_id', 'student_id'] : ['company_id', 'student_id'];

  const hasActive = !!(filters.date_from || filters.date_to || filters.company_id || filters.student_id || (showSupervisor && filters.supervisor_id));
  const set = (patch: Partial<AnalyticsFilters>) => onChange({ ...filters, ...patch });

  return (
    <Card>
      <Text className="mb-1.5 text-sm font-medium text-gray-700">Date Range</Text>
      <View className="flex-row gap-3">
        <DateField
          label="From"
          value={filters.date_from}
          maximumDate={filters.date_to ?? today}
          onChange={(date_from) => set({ date_from })}
          error={errors.date_from}
        />
        <DateField
          label="To"
          value={filters.date_to}
          minimumDate={filters.date_from}
          maximumDate={today}
          onChange={(date_to) => set({ date_to })}
          error={errors.date_to}
        />
      </View>
      {!filters.date_from && !filters.date_to ? (
        <Text className="mt-1.5 text-xs text-gray-500">Trends show the last 30 days unless you pick dates.</Text>
      ) : null}

      <View className="mt-4 flex-row flex-wrap gap-2">
        {keys.map((key) => {
          const list = lists[key];
          const value = filters[key];
          const selected = value !== null ? list.options.find((o) => o.value === value)?.label : undefined;
          const active = value !== null;
          return (
            <Pressable
              key={key}
              onPress={() => setOpen(key)}
              accessibilityRole="button"
              accessibilityLabel={`${list.title} filter: ${selected ?? list.all}`}
              hitSlop={4}
              className={`h-10 max-w-full flex-row items-center gap-1.5 rounded-full border px-3.5 ${
                active ? 'border-brand-700 bg-brand-50' : 'border-gray-300 bg-white'
              }`}>
              <Text className={`shrink text-sm font-medium ${active ? 'text-brand-800' : 'text-gray-700'}`} numberOfLines={1}>
                {selected ?? (active ? `${list.title} #${value}` : list.all)}
              </Text>
              <Ionicons name="chevron-down" size={16} color={active ? colors.brand700 : colors.gray500} />
            </Pressable>
          );
        })}
      </View>
      {keys.map((key) => (errors[key] ? <Text key={key} className="mt-1.5 text-sm text-red-600">{errors[key]}</Text> : null))}

      {hasActive ? (
        <Pressable
          onPress={() => onChange({ date_from: null, date_to: null, company_id: null, supervisor_id: null, student_id: null })}
          accessibilityRole="button"
          className="mt-3 min-h-11 flex-row items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white active:bg-gray-50">
          <Ionicons name="close" size={16} color={colors.gray500} />
          <Text className="text-sm font-medium text-gray-700">Clear Filters</Text>
        </Pressable>
      ) : null}

      {open ? (
        <SelectSheet
          visible
          title={lists[open].title}
          allLabel={lists[open].all}
          options={lists[open].options}
          selected={filters[open]}
          onSelect={(value) => set({ [open]: value })}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </Card>
  );
}
