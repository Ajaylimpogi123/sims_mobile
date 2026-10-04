import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApproval } from '@/api/approvals';
import { useAuth } from '@/auth/AuthProvider';
import { toApiError } from '@/api/errors';
import type { ApprovalItem, AttendanceLeg } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatLongDate, formatTime } from '@/lib/datetime';
import { formatNumber, TABULAR } from '@/lib/format';
import { hrefForFeature } from '@/navigation/access';
import { colors } from '@/theme/colors';

import { AttendancePhoto } from '../attendance/AttendancePhoto';
import { formatAccuracy, formatCoordinates, openInMaps } from '../attendance/photo';

import { legLocation, MockedLocationBadge } from './Evidence';
import { setApprovalsFlash } from './flash';
import { LEG_SHORT, legLabel, rejectSubtitle, studentMeta } from './format';
import { LegActions } from './LegActions';
import { NoticeBar } from './NoticeBar';
import { RejectSheet } from './RejectSheet';
import { useApprovalActions, type ApprovalActions } from './useApprovalActions';

const LEGS: AttendanceLeg[] = ['time_in', 'time_out'];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="min-h-8 flex-row items-center gap-3">
      <Text className="w-28 text-sm text-gray-600">{label}</Text>
      <View className="flex-1">{children}</View>
    </View>
  );
}

/** One leg's evidence: full-width photo (tap for full screen), time, location with Open in Maps, decision. */
function LegSection({ item, leg, actions }: { item: ApprovalItem; leg: AttendanceLeg; actions: ApprovalActions }) {
  const time = item[leg];
  const status = item[`${leg}_status`];
  const reason = item[`${leg}_rejection_reason`];
  const { latitude, longitude, accuracy, hasLocation, mocked } = legLocation(item, leg);
  const label = legLabel(item, leg);

  if (!time && !status) {
    return (
      <Card title={label}>
        <Text className="text-sm text-gray-500">Not recorded</Text>
      </Card>
    );
  }

  return (
    <Card title={label} right={status ? <StatusBadge status={status} /> : undefined}>
      <View className="gap-3">
        <AttendancePhoto size="lg" url={item[`${leg}_photo_url`]} label={`${LEG_SHORT[leg]} photo, ${item.student.name}`} />
        <View>
          <Row label="Requested Time">
            <Text className="text-base font-medium text-gray-900" style={TABULAR}>
              {time ? formatTime(time) : '-'}
            </Text>
          </Row>
          <Row label="Location">
            {hasLocation && latitude !== null && longitude !== null ? (
              <View>
                <Text className="text-sm text-gray-900" style={TABULAR} selectable>
                  {formatCoordinates(latitude, longitude)}
                </Text>
                <Text className="text-xs text-gray-500" style={TABULAR}>
                  {formatAccuracy(accuracy)}
                </Text>
              </View>
            ) : (
              <Text className="text-sm text-gray-500">No location</Text>
            )}
          </Row>
        </View>
        {mocked ? <MockedLocationBadge /> : null}
        {hasLocation && latitude !== null && longitude !== null ? (
          <Button
            label="Open in Maps"
            icon="map-outline"
            variant="outline"
            onPress={() => openInMaps(latitude, longitude)}
            accessibilityHint="Opens Google Maps at this location"
          />
        ) : null}
        {leg === 'time_out' && item.note ? (
          <View className="gap-1 rounded-lg bg-gray-50 px-3 py-2">
            <Text className="text-xs font-medium text-gray-500">Note</Text>
            <Text className="text-sm leading-5 text-gray-800" selectable>
              {item.note}
            </Text>
          </View>
        ) : null}
        {status === 'rejected' && reason ? (
          <Text className="text-sm text-red-600">
            {LEG_SHORT[leg]} rejected: {reason}
          </Text>
        ) : null}
        <LegActions item={item} leg={leg} actions={actions} />
      </View>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <SkeletonPulse label="Loading the attendance record">
      <View className="gap-4 p-4">
        <View className="gap-2 rounded-2xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-6 w-2/3" />
          <SkeletonBlock className="h-4 w-1/2" />
        </View>
        <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-60 w-full rounded-xl" />
          <SkeletonBlock className="h-4 w-full" />
          <View className="flex-row gap-3">
            <SkeletonBlock className="h-12 flex-1 rounded-xl" />
            <SkeletonBlock className="h-12 flex-1 rounded-xl" />
          </View>
        </View>
      </View>
    </SkeletonPulse>
  );
}

/** One attendance record's evidence (website: AttendanceEvidence, opened full size) with Approve / Reject per pending leg. */
export function ApprovalDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const approval = useApproval(id);
  const [pulling, setPulling] = useState(false);
  const { me } = useAuth();

  const backToList = () => {
    if (router.canGoBack()) router.back();
    else {
      const href = hrefForFeature('approvals', me);
      if (href) router.replace(href);
    }
  };

  const onDecided = useCallback(
    (fresh: ApprovalItem, message: string) => {
      // Nothing left to review here: back to the list, which shows the message.
      if (fresh.pending_legs.length === 0 && router.canGoBack()) {
        setApprovalsFlash(message);
        router.back();
      }
    },
    [router],
  );
  const actions = useApprovalActions(onDecided);

  const refresh = async () => {
    setPulling(true);
    try {
      await approval.refetch();
    } finally {
      setPulling(false);
    }
  };

  const error = approval.isError ? toApiError(approval.error) : null;
  const item = approval.data;

  if (id === null || (error?.kind === 'not_found' && !item)) {
    return (
      <View className="flex-1 justify-center bg-gray-50 p-4">
        <EmptyState icon="document-outline" message="This attendance record is no longer available." />
        <Button label="Back to Pending Approvals" variant="outline" onPress={backToList} />
      </View>
    );
  }
  if (!item) {
    if (error) {
      return (
        <View className="flex-1 bg-gray-50 p-4">
          <ErrorState message={error.message} onRetry={() => void approval.refetch()} retrying={approval.isFetching} />
        </View>
      );
    }
    return (
      <View className="flex-1 bg-gray-50">
        <DetailSkeleton />
      </View>
    );
  }

  const meta = studentMeta(item);
  const rejecting = actions.rejecting;

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerClassName="gap-4 p-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {approval.isRefetchError ? <Banner tone="warning" message={`Showing saved data. ${error?.message ?? ''}`} /> : null}

        <Card>
          <View className="gap-1">
            <Text accessibilityRole="header" className="text-xl font-semibold text-gray-900">
              {item.student.name}
            </Text>
            {meta ? <Text className="text-sm text-gray-600">{meta}</Text> : null}
            <Text className="text-sm text-gray-600">{formatLongDate(item.date)}</Text>
            {item.rendered_hours !== null ? (
              <Text className="text-sm text-gray-600" style={TABULAR}>
                Rendered: {formatNumber(item.rendered_hours)} hrs
              </Text>
            ) : null}
          </View>
        </Card>

        {item.pending_legs.length === 0 ? <Banner tone="info" message="No pending requests for this record." /> : null}

        {LEGS.map((leg) => (
          <LegSection key={leg} item={item} leg={leg} actions={actions} />
        ))}
      </ScrollView>

      <NoticeBar notice={actions.notice} onDismiss={actions.dismissNotice} bottom={insets.bottom + 16} />

      <RejectSheet
        visible={rejecting !== null}
        title={rejecting ? `Reject ${legLabel(rejecting.item, rejecting.leg)}` : ''}
        subtitle={rejecting ? rejectSubtitle(rejecting.item, rejecting.leg) : ''}
        submitting={actions.busy?.decision === 'reject'}
        fieldError={actions.sheetFieldError}
        error={actions.sheetError}
        onSubmit={actions.submitReject}
        onClose={actions.closeReject}
      />
    </View>
  );
}
