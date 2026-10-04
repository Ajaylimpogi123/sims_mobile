import { View } from 'react-native';

import type { ApprovalItem, AttendanceLeg } from '@/api/types';
import { Button } from '@/components/ui/Button';

import { legLabel } from './format';
import type { ApprovalActions } from './useApprovalActions';

/**
 * Reject + Approve for one pending leg (website: the row's Approve / Reject buttons). Only what the
 * server says this user may do (`review`); every button is disabled while any decision is being sent.
 */
export function LegActions({ item, leg, actions }: { item: ApprovalItem; leg: AttendanceLeg; actions: ApprovalActions }) {
  const { can_approve, can_reject } = item.review[leg];
  if (!can_approve && !can_reject) return null;

  const { busy } = actions;
  const mine = busy?.id === item.id && busy.leg === leg;
  const label = legLabel(item, leg);

  return (
    <View className="flex-row gap-3">
      {can_reject ? (
        <Button
          label="Reject"
          variant="danger"
          icon="close"
          onPress={() => actions.openReject(item, leg)}
          disabled={busy !== null}
          loading={mine && busy?.decision === 'reject'}
          accessibilityHint={`Rejects the ${label} of ${item.student.name}, with an optional reason`}
          className="flex-1"
        />
      ) : null}
      {can_approve ? (
        <Button
          label="Approve"
          icon="checkmark"
          onPress={() => actions.approve(item, leg)}
          disabled={busy !== null}
          loading={mine && busy?.decision === 'approve'}
          loadingLabel="Approving…"
          accessibilityHint={`Approves the ${label} of ${item.student.name}`}
          className="flex-1"
        />
      ) : null}
    </View>
  );
}
