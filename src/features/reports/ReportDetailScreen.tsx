import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MESSAGES, toApiError } from '@/api/errors';
import { useDeleteReport, useReport } from '@/api/reports';
import type { Report } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/datetime';
import { colors } from '@/theme/colors';

import { AttachmentCard } from './AttachmentCard';
import { setReportsFlash, takeReportsFlash } from './flash';
import { formatPeriod, TYPE_LABEL } from './format';

function DetailSkeleton() {
  return (
    <SkeletonPulse label="Loading report">
      <View className="gap-4 p-4">
        <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-4 w-2/3" />
        </View>
        <View className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-3/4" />
        </View>
      </View>
    </SkeletonPulse>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color={colors.gray500} />
      <Text className="flex-1 text-sm text-gray-600">{text}</Text>
    </View>
  );
}

function ReviewerCard({ report }: { report: Report }) {
  if (report.status !== 'reviewed') {
    return (
      <Card title="Reviewer Comment">
        <Text className="text-sm text-gray-500">Not reviewed yet.</Text>
      </Card>
    );
  }
  const reviewedBy = [report.reviewer?.name ? `Reviewed by ${report.reviewer.name}` : 'Reviewed', report.reviewed_at ? formatDateTime(report.reviewed_at) : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card title="Reviewer Comment">
      <Text selectable className={`text-base leading-6 ${report.reviewer_comment ? 'text-gray-900' : 'text-gray-500'}`}>
        {report.reviewer_comment || 'No comment.'}
      </Text>
      <Text className="mt-3 text-xs text-gray-500">{reviewedBy}</Text>
    </Card>
  );
}

/** Route entry: /report/12 */
export function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reportId = Number(id);
  if (!Number.isInteger(reportId) || reportId <= 0) return <Missing message={MESSAGES.notFound} />;
  return <ReportDetail id={reportId} />;
}

function Missing({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title: 'Report' }} />
      <Banner tone="warning" message={message} />
      <Button label="Back to My Reports" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

function ReportDetail({ id }: { id: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useReport(id);
  const remove = useDeleteReport();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const lastOpen = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const message = takeReportsFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const report = query.data;

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  const openEdit = () => {
    // A quick double tap must not open the form twice.
    const now = Date.now();
    if (now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    setProblem(null);
    router.push({ pathname: '/report-form', params: { id: String(id) } });
  };

  const confirmDelete = () => {
    if (remove.isPending) return;
    Alert.alert('Delete this report?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          remove.mutate(id, {
            onSuccess: (response) => {
              setReportsFlash(response.message);
              router.back();
            },
            onError: (error) => {
              const apiError = toApiError(error);
              if (apiError.endsSession) return;
              setFlash(null);
              // report_not_pending re-renders from the fresh report (no more Edit / Delete).
              setProblem(apiError.message);
            },
          }),
      },
    ]);
  };

  if (!report) {
    if (query.isPending) {
      return (
        <View className="flex-1 bg-gray-50">
          <Stack.Screen options={{ title: 'Report' }} />
          <DetailSkeleton />
        </View>
      );
    }
    const error = toApiError(query.error);
    if (error.kind === 'not_found') return <Missing message="We couldn't find that report. It may have been deleted." />;
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Report' }} />
        <ErrorState message={error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </View>
    );
  }

  const deletedMeanwhile = query.isRefetchError && toApiError(query.error).kind === 'not_found';
  const canEdit = report.can_edit && !deletedMeanwhile;
  const canDelete = report.can_delete && !deletedMeanwhile;

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: `${TYPE_LABEL[report.type]} Report` }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-8"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {flash ? <Banner tone="success" message={flash} /> : null}
        {problem ? <Banner message={problem} /> : null}
        {deletedMeanwhile ? (
          <Banner tone="warning" message="We couldn't find that report. It may have been deleted." />
        ) : query.isRefetchError ? (
          <Banner tone="warning" message={`Showing saved data. ${toApiError(query.error).message}`} />
        ) : null}

        <Card>
          <View className="flex-row items-start justify-between gap-3">
            <Text accessibilityRole="header" className="flex-1 text-xl font-semibold text-gray-900">
              {formatPeriod(report)}
            </Text>
            <StatusBadge status={report.status} />
          </View>
          <View className="mt-3 gap-1.5">
            <Meta icon="document-text-outline" text={`${TYPE_LABEL[report.type]} report`} />
            <Meta icon="time-outline" text={`Submitted ${formatDateTime(report.created_at)}`} />
          </View>
        </Card>

        <Card title="Accomplishment Details">
          <Text selectable className="text-base leading-6 text-gray-900">
            {report.content}
          </Text>
        </Card>

        {report.attachment ? <AttachmentCard attachment={report.attachment} /> : null}

        <ReviewerCard report={report} />
      </ScrollView>

      {canEdit || canDelete ? (
        <View className="flex-row gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {canDelete ? (
            <Button
              label="Delete"
              icon="trash-outline"
              variant="danger"
              className="flex-1"
              loading={remove.isPending}
              loadingLabel="Deleting…"
              onPress={confirmDelete}
            />
          ) : null}
          {canEdit ? <Button label="Edit" icon="create-outline" className="flex-1" disabled={remove.isPending} onPress={openEdit} /> : null}
        </View>
      ) : null}
    </View>
  );
}
