import { Pressable, View } from 'react-native';

import { formatNumber, TABULAR } from '@/lib/format';
import { Text } from '@/components/ui/Text';

/** The website's wording (Components/RequiredHoursNotSet.jsx) for a student with no required hours. */
export const REQUIRED_HOURS_NOT_SET = 'Required hours not set';

/**
 * The website's RequiredHoursNotSet: shown in place of a progress bar when required_hours is null,
 * with a "Set" link for roles that may edit required hours (can_edit_required_hours).
 */
export function RequiredHoursNotSet({ onSet }: { onSet?: () => void }) {
  return (
    <View className="min-h-6 flex-row flex-wrap items-center gap-x-2">
      <Text className="text-sm text-gray-500">{REQUIRED_HOURS_NOT_SET}</Text>
      {onSet ? (
        <Pressable
          onPress={onSet}
          accessibilityRole="button"
          accessibilityLabel="Set Required Hours"
          hitSlop={14}
          className="rounded-md px-1 active:bg-brand-50">
          <Text className="text-sm font-medium text-brand-700">Set</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface HoursProgressBarProps {
  rendered: number;
  required: number | null;
  /** From the API; computed like the website's bar when missing. */
  percent?: number | null;
  /** Hide the "120.5/486 hrs (25%)" caption (when the numbers are shown elsewhere). */
  hideCaption?: boolean;
  /** When required hours aren't set: offers "Set" (pass it only when the role may edit them). */
  onSetRequired?: () => void;
}

/** The website's HoursProgressBar: emerald bar on gray-100, "rendered/required hrs (percent%)". */
export function HoursProgressBar({ rendered, required, percent, hideCaption = false, onSetRequired }: HoursProgressBarProps) {
  if (required === null) return <RequiredHoursNotSet onSet={onSetRequired} />;
  const pct = percent ?? (required > 0 ? Math.min(Math.round((rendered / required) * 100), 100) : 0);

  return (
    <View className="gap-1.5">
      <View
        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${formatNumber(rendered)} of ${formatNumber(required)} hours`}
        accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </View>
      {hideCaption ? null : (
        <Text className="text-xs text-gray-500" style={TABULAR}>
          {formatNumber(rendered)}/{formatNumber(required)} hrs ({pct}%)
        </Text>
      )}
    </View>
  );
}
