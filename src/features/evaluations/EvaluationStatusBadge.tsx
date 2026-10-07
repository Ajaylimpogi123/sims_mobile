import { View } from 'react-native';

import type { EvaluationStatus } from '@/api/types';

import { STATUS_LABEL } from './format';
import { Text } from '@/components/ui/Text';

/**
 * The website's evaluation pages colour their status pill locally (SupervisorEvaluations/Index.jsx
 * and Show.jsx STATUS_STYLES), not with the shared StatusBadge: draft gray, submitted amber, locked
 * green. Same here, so the shared map stays as it is for every other screen.
 */
const STYLES: Record<EvaluationStatus, { box: string; text: string }> = {
  draft: { box: 'bg-gray-100', text: 'text-gray-700' },
  submitted: { box: 'bg-amber-100', text: 'text-amber-700' },
  locked: { box: 'bg-green-100', text: 'text-green-700' },
};

export function EvaluationStatusBadge({ status }: { status: EvaluationStatus }) {
  const style = STYLES[status] ?? STYLES.draft;
  const label = STATUS_LABEL[status] ?? status;
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${style.box}`} accessibilityLabel={`Status: ${label}`}>
      <Text className={`text-xs font-medium ${style.text}`}>{label}</Text>
    </View>
  );
}
