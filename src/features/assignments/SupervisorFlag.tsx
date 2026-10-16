import { View } from 'react-native';

import type { SupervisorIssue } from '@/api/types';
import { Text } from '@/components/ui/Text';

/**
 * A company (and so each of its students) has one Company Supervisor. The server's
 * `supervisor_issue` says why there's no working one; first match wins in this order:
 * no_supervisor, not_a_supervisor (the account lost the Supervisor role), inactive.
 */

/** Pill text per issue (the website's StatusBadge labels). */
export const SUPERVISOR_ISSUE_LABELS: Record<SupervisorIssue, string> = {
  no_supervisor: 'No supervisor',
  not_a_supervisor: 'Not a supervisor',
  inactive: 'Supervisor inactive',
};

/** Picker suffix for a kept current supervisor who is no longer a valid pick: "Jane Cruz (inactive)". */
export const SUPERVISOR_ISSUE_SUFFIX: Partial<Record<SupervisorIssue, string>> = {
  inactive: 'inactive',
  not_a_supervisor: 'not a supervisor',
};

/** The flag's text, or null when the server reports no issue. */
export function supervisorFlagLabel(subject: { supervisor_issue: SupervisorIssue | null }): string | null {
  return subject.supervisor_issue ? SUPERVISOR_ISSUE_LABELS[subject.supervisor_issue] : null;
}

/** Amber pill for a company or student the server flags `supervisor_issue`. Same pill as the website's. */
export function SupervisorFlag({ subject }: { subject: { supervisor_issue: SupervisorIssue | null } }) {
  const label = supervisorFlagLabel(subject);
  if (!label) return null;
  return (
    <View className="self-start rounded-full bg-amber-100 px-2 py-0.5" accessibilityLabel={label}>
      <Text className="text-xs font-medium text-amber-700">{label}</Text>
    </View>
  );
}

/** Amber hint for a student's (read-only) supervisor, per issue. Website wording (StudentModal). */
export const STUDENT_SUPERVISOR_HINTS: Record<SupervisorIssue, string> = {
  no_supervisor: 'This company has no supervisor yet — set one in Company Management.',
  inactive: "This company's supervisor account is inactive. Set an active supervisor in Company Management.",
  not_a_supervisor: "This company's supervisor account is no longer a Supervisor. Set a new one in Company Management.",
};
