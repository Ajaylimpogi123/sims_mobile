import { View } from 'react-native';
import { Text } from './Text';

/**
 * Status pill, copied from the website's resources/js/Components/StatusBadge.jsx.
 * Keep this map identical to the web one; never colour a status inline.
 */
const STATUS_CONFIG: Record<string, { label: string; box: string; text: string }> = {
  active: { label: 'Active', box: 'bg-green-100', text: 'text-green-700' },
  inactive: { label: 'Inactive', box: 'bg-gray-100', text: 'text-gray-600' },
  ongoing: { label: 'Ongoing', box: 'bg-blue-100', text: 'text-blue-700' },
  completed: { label: 'Completed', box: 'bg-green-100', text: 'text-green-700' },
  not_started: { label: 'Not Started', box: 'bg-gray-100', text: 'text-gray-600' },
  pending: { label: 'Pending', box: 'bg-amber-100', text: 'text-amber-700' },
  reviewed: { label: 'Reviewed', box: 'bg-green-100', text: 'text-green-700' },
  draft: { label: 'Draft', box: 'bg-gray-100', text: 'text-gray-600' },
  submitted: { label: 'Submitted', box: 'bg-blue-100', text: 'text-blue-700' },
  locked: { label: 'Locked', box: 'bg-purple-100', text: 'text-purple-700' },
  approved: { label: 'Approved', box: 'bg-green-100', text: 'text-green-700' },
  rejected: { label: 'Rejected', box: 'bg-red-100', text: 'text-red-700' },
};

/** Same fallback as the web: unknown statuses render as Active (if "active") or Inactive. */
export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? (status === 'active' ? STATUS_CONFIG.active : STATUS_CONFIG.inactive);
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${config.box}`} accessibilityLabel={`Status: ${config.label}`}>
      <Text className={`text-xs font-medium ${config.text}`}>{config.label}</Text>
    </View>
  );
}
