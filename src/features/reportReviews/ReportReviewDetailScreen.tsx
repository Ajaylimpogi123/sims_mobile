import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toApiError } from '@/api/errors';
import { alreadyReviewed, REVIEW_COMMENT_MAX, useReviewReport, useReviewReportMutation } from '@/api/reportReviews';
import type { ReviewReport } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { formatNumber } from '@/lib/format';
import { colors } from '@/theme/colors';

import { AttachmentCard } from '../reports/AttachmentCard';
import { ReportContentCard, ReportMeta, ReportSummaryCard, ReviewerCard } from '../reports/ReportParts';

import { setReviewsFlash } from './flash';
import { courseSection, reviewStudentMeta } from './format';

/** Website flash text (ReportReviewController) when the report was deleted meanwhile. */
const GONE_MESSAGE = 'This report no longer exists.';

function DetailSkeleton() {
  return (
    <SkeletonPulse label="Loading report">
      <View className="gap-4 p-4">
        <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-4 w-1/2" />
        </View>
        <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-3/4" />
        </View>
      </View>
    </SkeletonPulse>
  );
}

function StudentLines({ report }: { report: ReviewReport }) {
  const course = courseSection(report.student);
  return (
    <>
      <ReportMeta icon="person-outline" text={report.student.name} />
      <ReportMeta icon="business-outline" text={[reviewStudentMeta(report.student), course].filter(Boolean).join(' · ')} />
    </>
  );
}

/** Route entry: /report-review/12 (Supervisor view only; Coordinator / Admin review). */
export function ReportReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const reportId = id && /^\d+$/.test(id) ? Number(id) : null;
  if (reportId === null || reportId <= 0) return <Missing message={GONE_MESSAGE} />;
  return <ReportReviewDetail id={reportId} />;
}

function Missing({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title: 'Report' }} />
      <EmptyState icon="document-text-outline" message={message} />
      {router.canGoBack() ? <Button label="Back to Report Reviews" variant="outline" onPress={() => router.back()} /> : null}
    </View>
  );
}

function ReportReviewDetail({ id }: { id: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useReviewReport(id);
  const review = useReviewReportMutation();
  const [comment, setComment] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const submitting = useRef(false);

  const report = query.data;

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  const submit = async () => {
    // One review in flight; a second tap is ignored (the server also refuses a replay).
    if (submitting.current || !report) return;
    submitting.current = true;
    setProblem(null);
    setFieldError(null);
    try {
      const response = await review.mutateAsync({ id, comment });
      // Like the website: back to the list, which shows "Report reviewed.".
      if (router.canGoBack()) {
        setReviewsFlash(response.message);
        router.back();
      } else {
        setDone(response.message);
      }
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.endsSession) return;
      if (alreadyReviewed(error)) {
        // The screen re-renders from the fresh report (no more form); say why.
        setProblem(apiError.message);
      } else if (apiError.kind === 'validation' && apiError.fieldErrors.comment) {
        setFieldError(apiError.fieldErrors.comment);
      } else if (apiError.kind === 'not_found') {
        setProblem(GONE_MESSAGE);
      } else {
        setProblem(apiError.message);
      }
    } finally {
      submitting.current = false;
    }
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
    if (error.kind === 'not_found') return <Missing message={GONE_MESSAGE} />;
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title: 'Report' }} />
        <ErrorState message={error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </View>
    );
  }

  const goneMeanwhile = query.isRefetchError && toApiError(query.error).kind === 'not_found';
  const canReview = report.can_review && !goneMeanwhile && problem !== GONE_MESSAGE;
  const chars = [...comment].length;
  const tooLong = chars > REVIEW_COMMENT_MAX;

  return (
    <KeyboardAvoidingView className="flex-1 bg-gray-50" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Website dialog title: "Review Report — Name" / "Report — Name". */}
      <Stack.Screen options={{ title: canReview ? 'Review Report' : 'Report' }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-8"
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {done ? <Banner tone="success" message={done} /> : null}
        {problem ? <Banner message={problem} /> : null}
        {goneMeanwhile && problem !== GONE_MESSAGE ? (
          <Banner tone="warning" message={GONE_MESSAGE} />
        ) : query.isRefetchError ? (
          <Banner tone="warning" message={`Showing saved data. ${toApiError(query.error).message}`} />
        ) : null}

        <ReportSummaryCard report={report}>
          <StudentLines report={report} />
        </ReportSummaryCard>
        <ReportContentCard report={report} />
        {report.attachment ? <AttachmentCard attachment={report.attachment} /> : null}

        {canReview ? (
          <Card title="Review">
            <TextField
              label="Comment"
              value={comment}
              onChangeText={(text) => {
                setComment(text);
                if (fieldError) setFieldError(null);
              }}
              multiline
              editable={!review.isPending}
              placeholder="Optional"
              error={fieldError ?? (tooLong ? `The comment field must not be greater than ${formatNumber(REVIEW_COMMENT_MAX)} characters.` : null)}
              counter={chars >= REVIEW_COMMENT_MAX * 0.8 ? `${formatNumber(chars)} / ${formatNumber(REVIEW_COMMENT_MAX)}` : undefined}
            />
          </Card>
        ) : (
          <ReviewerCard report={report} />
        )}
      </ScrollView>

      {canReview ? (
        <View className="border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <Button
            label="Mark Reviewed"
            icon="checkmark-circle-outline"
            loading={review.isPending}
            loadingLabel="Saving…"
            disabled={tooLong}
            onPress={() => void submit()}
            accessibilityHint="Marks the report reviewed and notifies the student"
          />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
