import { Text, View } from 'react-native';

const SCALE = [1, 2, 3, 4, 5] as const;

/**
 * Read-only 1-5 rating, like the website's CriteriaRatingGroup in read-only mode:
 * five numbered circles, the given score filled in brand green, "Not rated" when empty.
 */
export function RatingScale({ rating }: { rating: number | null }) {
  const value = rating !== null && rating >= 1 && rating <= 5 ? Math.round(rating) : null;
  return (
    <View
      className="flex-row flex-wrap items-center gap-2"
      accessible
      accessibilityLabel={value !== null ? `Rating ${value} out of 5` : 'Not rated'}>
      {SCALE.map((score) => {
        const selected = score === value;
        return (
          <View
            key={score}
            className={`h-8 w-8 items-center justify-center rounded-full border ${selected ? 'border-brand-700 bg-brand-700' : 'border-gray-200 bg-white'}`}>
            <Text
              className={`text-sm font-medium ${selected ? 'text-white' : 'text-gray-400'}`}
              style={{ fontVariant: ['tabular-nums'] }}>
              {score}
            </Text>
          </View>
        );
      })}
      {value === null ? <Text className="text-xs text-gray-500">Not rated</Text> : null}
    </View>
  );
}
