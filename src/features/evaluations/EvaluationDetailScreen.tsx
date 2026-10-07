import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MESSAGES, toApiError } from '@/api/errors';
import { evaluationFromLists, evaluationRuleRefusal, useEvaluation, useEvaluationAction, type EvaluationAction } from '@/api/evaluations';
import type { EvaluationDetail, EvaluationSummary } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { formatDateTime } from '@/lib/datetime';
import { TABULAR } from '@/lib/format';
import { colors } from '@/theme/colors';

import { CategorySection, TextSection } from '../feedback/FeedbackDetailScreen';
import { formatFeedbackPeriod, formatRating } from '../feedback/format';

import { EvaluationStatusBadge } from './EvaluationStatusBadge';
import { takeEvaluationsFlash } from './flash';
import { Text } from '@/components/ui/Text';

const TITLE = 'Evaluation Detail';
const NOT_FOUND = "We couldn't find that evaluation. It may have been removed or reassigned.";

/** Confirm text per action (website: the Submit confirm(); lock / reopen get one here too). */
const CONFIRM: Record<EvaluationAction, { title: string; message: string; button: string }> = {
  submit: {
    title: 'Submit Evaluation?',
    message: 'Submit this evaluation? Once submitted it can no longer be edited unless an administrator reopens it.',
    button: 'Submit',
  },
  lock: {
    title: 'Lock Evaluation?',
    message: 'Lock this evaluation? It stays visible to the student and can only be changed after it is reopened.',
    button: 'Lock',
  },
  reopen: {
    title: 'Reopen for Editing?',
    message: "This evaluation goes back to draft so its supervisor can edit it. The student won't see it until it is submitted again.",
    button: 'Reopen',
  },
};

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color={colors.gray500} />
      <Text className="flex-1 text-sm text-gray-600">{text}</Text>
    </View>
  );
}

/** Website Show header: student, period · company · supervisor, status; plus the overall rating. */
function HeaderCard({ item }: { item: EvaluationSummary }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text accessibilityRole="header" className="text-xl font-semibold text-gray-900">
            {item.student?.name ?? '—'}
          </Text>
          <Text className="text-sm text-gray-600" style={TABULAR}>
            {formatFeedbackPeriod(item)}
          </Text>
        </View>
        <EvaluationStatusBadge status={item.status} />
      </View>
      <View className="mt-3 gap-1.5">
        {item.student?.student_number ? <Meta icon="id-card-outline" text={item.student.student_number} /> : null}
        <Meta icon="business-outline" text={item.company?.name || '—'} />
        <Meta icon="person-outline" text={`Supervisor: ${item.supervisor?.name || '—'}`} />
        {item.submitted_at ? <Meta icon="time-outline" text={`Submitted ${formatDateTime(item.submitted_at)}`} /> : null}
        {item.status === 'locked' && item.locked_at ? (
          <Meta
            icon="lock-closed-outline"
            text={item.locked_by ? `Locked by ${item.locked_by.name} on ${formatDateTime(item.locked_at)}` : `Locked ${formatDateTime(item.locked_at)}`}
          />
        ) : null}
      </View>
      <View
        className="mt-4 flex-row items-baseline justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
        accessible
        accessibilityLabel={`Overall Rating: ${formatRating(item.overall_rating)} out of ${item.rating_max}`}>
        <Text className="text-sm text-gray-700">Overall Rating</Text>
        <Text className="text-sm text-gray-700" style={TABULAR}>
          <Text className="text-base font-semibold text-gray-900">{formatRating(item.overall_rating)}</Text>/{item.rating_max}
        </Text>
      </View>
    </Card>
  );
}

function Body({ evaluation }: { evaluation: EvaluationDetail }) {
  const hasText = !!(evaluation.strengths || evaluation.areas_for_improvement || evaluation.recommendations || evaluation.supervisor_remarks);
  return (
    <>
      {evaluation.categories.length ? (
        evaluation.categories.map((group) => <CategorySection key={group.category} group={group} />)
      ) : (
        <Card>
          <Text className="text-sm text-gray-500">{evaluation.status === 'draft' ? 'No criteria rated yet.' : 'No ratings were saved.'}</Text>
        </Card>
      )}
      <TextSection label="Strengths" value={evaluation.strengths} />
      <TextSection label="Areas for Improvement" value={evaluation.areas_for_improvement} />
      <TextSection label="Recommendations" value={evaluation.recommendations} />
      <TextSection label="Supervisor Remarks" value={evaluation.supervisor_remarks} />
      {!hasText && evaluation.status === 'draft' ? (
        <Text className="px-1 text-sm text-gray-500">No strengths, areas for improvement, recommendations or remarks yet.</Text>
      ) : null}
    </>
  );
}

function BodySkeleton() {
  return (
    <View className="gap-3 rounded-xl border border-gray-200 bg-white p-4">
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-1/2" />
      <SkeletonBlock className="h-8 w-48" />
    </View>
  );
}

/** Route entry: /evaluation/7 */
export function EvaluationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const evaluationId = Number(id);
  if (!Number.isInteger(evaluationId) || evaluationId <= 0) return <Missing message={MESSAGES.notFound} />;
  return <EvaluationDetailView id={evaluationId} />;
}

function Missing({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View className="flex-1 gap-3 bg-gray-50 p-4">
      <Stack.Screen options={{ title: TITLE }} />
      <Banner tone="warning" message={message} />
      <Button label="Back to Supervisor Monitoring & Feedback" variant="outline" onPress={() => router.back()} />
    </View>
  );
}

function EvaluationDetailView({ id }: { id: number }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const query = useEvaluation(id);
  const action = useEvaluationAction();
  const [pulling, setPulling] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const inFlight = useRef(false);
  const lastOpen = useRef(0);
  const scrollRef = useRef<ScrollView>(null);

  const evaluation = query.data;
  const summary: EvaluationSummary | undefined = evaluation ?? evaluationFromLists(queryClient, id);

  // "Evaluation draft saved." from the form, shown here like the website's redirect to Show.
  useFocusEffect(
    useCallback(() => {
      const message = takeEvaluationsFlash();
      if (message) {
        setFlash(message);
        setProblem(null);
      }
    }, []),
  );

  const refresh = async () => {
    setPulling(true);
    try {
      await query.refetch();
    } finally {
      setPulling(false);
    }
  };

  const run = async (kind: EvaluationAction) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setFlash(null);
    setProblem(null);
    try {
      const response = await action.mutateAsync({ id, action: kind });
      setFlash(response.message);
    } catch (error) {
      const apiError = toApiError(error);
      // evaluation_rule (status changed meanwhile) carries the fresh evaluation; it is already applied.
      if (evaluationRuleRefusal(error)) setProblem(apiError.message);
      else if (apiError.kind === 'validation') setProblem(Object.values(apiError.fieldErrors)[0] ?? apiError.message);
      else if (apiError.kind === 'not_found') setProblem(NOT_FOUND);
      else setProblem(apiError.message);
    } finally {
      inFlight.current = false;
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const confirm = (kind: EvaluationAction) => {
    if (inFlight.current) return;
    const text = CONFIRM[kind];
    Alert.alert(text.title, text.message, [
      { text: 'Cancel', style: 'cancel' },
      { text: text.button, onPress: () => void run(kind) },
    ]);
  };

  const edit = () => {
    const now = Date.now();
    if (now - lastOpen.current < 1000) return;
    lastOpen.current = now;
    setFlash(null);
    setProblem(null);
    router.push({ pathname: '/evaluation-form', params: { id: String(id) } });
  };

  if (!evaluation && query.isError) {
    const error = toApiError(query.error);
    if (error.kind === 'not_found') return <Missing message={NOT_FOUND} />;
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <Stack.Screen options={{ title: TITLE }} />
        <ErrorState message={error.message} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      </View>
    );
  }

  const goneMeanwhile = query.isRefetchError && toApiError(query.error).kind === 'not_found';
  const busy = action.isPending;
  const kind = action.variables?.action;
  // Buttons only from the API's flags (and never on a record that's gone).
  const flags = evaluation && !goneMeanwhile ? evaluation : null;
  const hasActions = !!flags && (flags.can_edit || flags.can_submit || flags.can_lock || flags.can_reopen);

  return (
    <View className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: TITLE }} />
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerClassName="gap-4 p-4 pb-8"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
        {goneMeanwhile ? (
          <Banner tone="warning" message={NOT_FOUND} />
        ) : query.isRefetchError ? (
          <Banner tone="warning" message={`Showing saved data. ${toApiError(query.error).message}`} />
        ) : null}
        {flash ? <Banner tone="success" message={flash} /> : null}
        {problem ? <Banner tone="error" message={problem} /> : null}

        {summary ? <HeaderCard item={evaluation ?? summary} /> : null}
        {evaluation ? (
          <Body evaluation={evaluation} />
        ) : (
          <SkeletonPulse label="Loading evaluation">
            <View className="gap-4">
              {summary ? null : <BodySkeleton />}
              <BodySkeleton />
            </View>
          </SkeletonPulse>
        )}
      </ScrollView>

      {hasActions && flags ? (
        <View className="gap-3 border-t border-gray-200 bg-white px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          {flags.can_edit || flags.can_submit ? (
            <View className="flex-row gap-3">
              {flags.can_edit ? <Button label="Edit Draft" icon="create-outline" variant="outline" onPress={edit} disabled={busy} className="flex-1" /> : null}
              {flags.can_submit ? (
                <Button
                  label="Submit Evaluation"
                  onPress={() => confirm('submit')}
                  loading={busy && kind === 'submit'}
                  loadingLabel="Submitting…"
                  disabled={busy}
                  className="flex-1"
                />
              ) : null}
            </View>
          ) : null}
          {flags.can_lock || flags.can_reopen ? (
            <View className="flex-row gap-3">
              {flags.can_lock ? (
                <Button
                  label="Lock Evaluation"
                  icon="lock-closed-outline"
                  variant="outline"
                  onPress={() => confirm('lock')}
                  loading={busy && kind === 'lock'}
                  loadingLabel="Locking…"
                  disabled={busy}
                  className="flex-1"
                />
              ) : null}
              {flags.can_reopen ? (
                <Button
                  label="Reopen for Editing"
                  icon="lock-open-outline"
                  variant="outline"
                  onPress={() => confirm('reopen')}
                  loading={busy && kind === 'reopen'}
                  loadingLabel="Reopening…"
                  disabled={busy}
                  className="flex-1"
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
