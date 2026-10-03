import { Text, View } from 'react-native';

import { formatNumber, TABULAR } from '@/lib/format';

interface HoursProgressBarProps {
  rendered: number;
  required: number | null;
  /** From the API; computed like the website's bar when missing. */
  percent?: number | null;
  /** Hide the "120.5/486 hrs (25%)" caption (when the numbers are shown elsewhere). */
  hideCaption?: boolean;
}

/** The website's HoursProgressBar: emerald bar on gray-100, "rendered/required hrs (percent%)". */
export function HoursProgressBar({ rendered, required, percent, hideCaption = false }: HoursProgressBarProps) {
  if (required === null) {
    return <Text className="text-xs text-gray-500">Required hours not set yet</Text>;
  }
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
