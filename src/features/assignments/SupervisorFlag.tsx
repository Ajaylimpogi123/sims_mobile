import { View } from 'react-native';

import type { AssignmentStudent } from '@/api/types';
import { Text } from '@/components/ui/Text';

/** Why a student without a working supervisor matters (form hint and student screen). Website wording. */
export const NO_SUPERVISOR_HINT = "Without a supervisor, no one can approve this student's attendance or reports.";

/** Form hint while the unchanged current supervisor is off the company's roster. Website wording. */
export const OFF_ROSTER_HINT =
  "This supervisor is no longer on this company's roster. Choose one from the roster, or add them back in Company Management.";

type Flaggable = Pick<AssignmentStudent, 'needs_supervisor' | 'supervisor' | 'supervisor_on_roster'>;

/** The flag's text, or null when the server didn't flag the student. */
export function supervisorFlagLabel(student: Flaggable): string | null {
  if (!student.needs_supervisor) return null;
  return student.supervisor && student.supervisor_on_roster === false ? 'Not on roster' : 'No supervisor';
}

/**
 * Amber pill for a student the server flags `needs_supervisor` (has a company, but no supervisor
 * or one no longer on its roster). Same pill shape and amber as the website's pending badge.
 */
export function SupervisorFlag({ student }: { student: Flaggable }) {
  const label = supervisorFlagLabel(student);
  if (!label) return null;
  return (
    <View className="self-start rounded-full bg-amber-100 px-2 py-0.5" accessibilityLabel={label}>
      <Text className="text-xs font-medium text-amber-700">{label}</Text>
    </View>
  );
}
