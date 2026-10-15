import { View } from 'react-native';

import type { AssignmentStudent } from '@/api/types';
import { Text } from '@/components/ui/Text';

/** Why a student without a working supervisor matters (form hint and student screen). Website wording. */
export const NO_SUPERVISOR_HINT = "Without a supervisor, no supervisor will see, approve or evaluate this student's work.";

/** Form hint while the unchanged current supervisor is off the company's roster. Website wording. */
export const OFF_ROSTER_HINT =
  "This supervisor is no longer on this company's roster. Choose one from the roster, or add them back in Company Management.";

/** Hint while the current supervisor's account no longer has the Supervisor role. Website wording. */
export const NOT_SUPERVISOR_HINT = "This account is no longer a Supervisor. Choose a supervisor from the company's roster.";

type Flaggable = Pick<AssignmentStudent, 'needs_supervisor' | 'supervisor' | 'supervisor_on_roster'>;

/**
 * Why the server flagged the student `needs_supervisor`, or null when it didn't:
 * none = no supervisor; off_roster = the supervisor left the company's roster; not_supervisor =
 * the supervisor's account no longer has the Supervisor role (the only case left once the
 * first two are ruled out; supervisor_on_roster can still be true there).
 */
export type SupervisorProblem = 'none' | 'off_roster' | 'not_supervisor';

export function supervisorProblem(student: Flaggable): SupervisorProblem | null {
  if (!student.needs_supervisor) return null;
  if (!student.supervisor) return 'none';
  if (student.supervisor_on_roster === false) return 'off_roster';
  return 'not_supervisor';
}

const LABELS: Record<SupervisorProblem, string> = {
  none: 'No supervisor',
  off_roster: 'Not on roster',
  not_supervisor: 'Not a supervisor',
};

/** The flag's text, or null when the server didn't flag the student. */
export function supervisorFlagLabel(student: Flaggable): string | null {
  const problem = supervisorProblem(student);
  return problem ? LABELS[problem] : null;
}

/**
 * Amber pill for a student the server flags `needs_supervisor` (has a company, but no supervisor,
 * one off its roster, or one who is no longer a Supervisor). Same pill as the website's.
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
