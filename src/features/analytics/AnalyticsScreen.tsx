import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { EMPTY_ANALYTICS_FILTERS, useAnalytics, useAnalyticsFilterOptions } from '@/api/dashboard';
import { toApiError } from '@/api/errors';
import { ROLE_SUPERVISOR, type AnalyticsFilters, type AnalyticsResponse, type ChartPoint } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Banner } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonBlock, SkeletonPulse } from '@/components/ui/Skeleton';
import { formatNumber, TABULAR } from '@/lib/format';
import { featureInfo } from '@/navigation/access';
import { chartColors, colors } from '@/theme/colors';

import {
  ChartCard,
  ColumnChart,
  DonutChart,
  listSummary,
  RankedBars,
  trendSummary,
  TrendChart,
  type Datum,
  type LineSeries,
} from './charts';
import { FilterBar } from './FilterBar';
import { Text } from '@/components/ui/Text';

/** Series colours by status key, the same as the website's charts. */
const OUTCOME_COLORS: Record<string, string> = { present: chartColors.positive, rejected: chartColors.rejected };
const EVALUATION_COLORS: Record<string, string> = {
  draft: chartColors.neutral,
  submitted: chartColors.submitted,
  locked: chartColors.positive,
};

const toData = (points: ChartPoint[], colorsByKey?: Record<string, string>): Datum[] =>
  points.map((p) => ({ label: p.label, value: p.value, color: colorsByKey?.[p.key] ?? (colorsByKey ? chartColors.neutral : undefined) }));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="mt-2 text-lg font-semibold text-gray-900">
        {title}
      </Text>
      {children}
    </View>
  );
}

function Charts({ data }: { data: AnalyticsResponse }) {
  const { internship, attendance, evaluation, reports } = data;

  const status = toData(internship.status_breakdown);
  const byCompany = toData(internship.students_by_company);
  const buckets = toData(internship.completion_progress);
  const outcomes = toData(attendance.outcomes, OUTCOME_COLORS);
  const attendanceDates = attendance.trend.map((d) => d.date);
  const attendanceSeries: LineSeries[] = [
    { label: 'Present', color: chartColors.positive, values: attendance.trend.map((d) => d.present) },
    { label: 'Rejected', color: chartColors.rejected, values: attendance.trend.map((d) => d.rejected) },
  ];
  const completion = toData(evaluation.completion, EVALUATION_COLORS);
  const byCategory = toData(evaluation.by_category);
  const funnel = toData(reports.funnel);
  const submissionDates = reports.submission_trend.map((d) => d.date);
  const submissionSeries: LineSeries[] = [
    { label: 'Reports', color: chartColors.reports, values: reports.submission_trend.map((d) => d.value) },
  ];

  return (
    <>
      <Section title="Internship">
        <ChartCard title="Internship Status Breakdown" summary={`Students: ${listSummary(status)}`} empty={status.length === 0} emptyMessage="No students yet.">
          {(w) => <ColumnChart data={status} color={chartColors.positive} width={w} />}
        </ChartCard>
        <ChartCard title="Students by Company" summary={listSummary(byCompany)} empty={byCompany.length === 0} emptyMessage="No company assignments yet.">
          {() => <RankedBars data={byCompany} color={chartColors.positive} />}
        </ChartCard>
        <ChartCard
          title="Completion Progress"
          summary={`Students by share of required hours: ${listSummary(buckets)}`}
          empty={buckets.every((b) => b.value === 0)}
          emptyMessage="No hours logged yet.">
          {(w) => <ColumnChart data={buckets} color={chartColors.positive} width={w} />}
        </ChartCard>
      </Section>

      <Section title="Attendance">
        <ChartCard title="Attendance Outcomes" summary={listSummary(outcomes)} empty={!outcomes.some((o) => o.value > 0)} emptyMessage="No attendance recorded yet.">
          {() => <DonutChart data={outcomes} />}
        </ChartCard>
        <ChartCard
          title="Attendance Trend"
          summary={trendSummary(attendanceDates, attendanceSeries)}
          empty={attendanceDates.length === 0}
          emptyMessage="No attendance recorded in this range.">
          {(w) => <TrendChart dates={attendanceDates} series={attendanceSeries} width={w} />}
        </ChartCard>
        <Card title="Frequent Rejections">
          {attendance.frequent_rejections.length === 0 ? (
            <EmptyState message="No students with repeated rejections." />
          ) : (
            attendance.frequent_rejections.map((row, index) => (
              <View
                key={row.student_id}
                className={`flex-row items-center gap-3 py-2.5 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                accessible
                accessibilityLabel={`${row.name ?? 'Unnamed student'}, ${row.rejection_count} rejected`}>
                <Text className="flex-1 text-sm text-gray-900" numberOfLines={1}>
                  {row.name ?? 'Unnamed student'}
                </Text>
                <Text className="text-sm font-medium text-red-600" style={TABULAR}>
                  {formatNumber(row.rejection_count)} rejected
                </Text>
              </View>
            ))
          )}
        </Card>
      </Section>

      <Section title="Evaluations">
        <ChartCard title="Evaluation Completion" summary={listSummary(completion)} empty={completion.length === 0} emptyMessage="No evaluations yet.">
          {() => <DonutChart data={completion} />}
        </ChartCard>
        <ChartCard
          title="Average Rating by Category"
          summary={`Average rating out of 5: ${listSummary(byCategory, 2)}`}
          empty={byCategory.length === 0}
          emptyMessage="No rated evaluations yet.">
          {() => <RankedBars data={byCategory} color={chartColors.rating} max={5} decimals={2} />}
        </ChartCard>
      </Section>

      <Section title="Reports">
        <ChartCard title="Reports Funnel" summary={`Reports: ${listSummary(funnel)}`} empty={funnel.length === 0} emptyMessage="No reports submitted yet.">
          {(w) => <ColumnChart data={funnel} color={chartColors.reports} width={w} />}
        </ChartCard>
        <ChartCard
          title="Submission Trend"
          summary={trendSummary(submissionDates, submissionSeries)}
          empty={submissionDates.length === 0}
          emptyMessage="No reports submitted in this range.">
          {(w) => <TrendChart dates={submissionDates} series={submissionSeries} width={w} />}
        </ChartCard>
      </Section>
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <SkeletonPulse label="Loading analytics">
      <View className="gap-4">
        {[0, 1, 2].map((i) => (
          <View key={i} className="gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <SkeletonBlock className="h-4 w-1/2" />
            <View className="h-40 flex-row items-end gap-4 px-6">
              {[0.5, 0.9, 0.35, 0.7].map((h, j) => (
                <View key={j} className="flex-1 rounded-t bg-gray-200" style={{ height: `${h * 100}%` }} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </SkeletonPulse>
  );
}

/**
 * Analytics for Supervisors (own students), Coordinators and Admins (system-wide): the website's
 * Dashboard "Analytics" tab. Filters apply as soon as they change, like the web; the server scopes
 * and validates them (403 outside a supervisor's students, 422 for bad dates).
 */
export function AnalyticsScreen() {
  const { user } = useAuth();
  const isSupervisor = user?.role_id === ROLE_SUPERVISOR;
  const [filters, setFilters] = useState<AnalyticsFilters>(EMPTY_ANALYTICS_FILTERS);
  const analytics = useAnalytics(filters);
  const options = useAnalyticsFilterOptions();
  const [pulling, setPulling] = useState(false);

  const error = analytics.error ? toApiError(analytics.error) : null;
  const fieldErrors = error?.kind === 'validation' ? error.fieldErrors : {};
  const data = analytics.data;
  const updating = analytics.isFetching && analytics.isPlaceholderData;

  // A 403 usually means the cached filter lists are out of date (e.g. a student was reassigned).
  const forbidden = error?.kind === 'forbidden';
  const refetchOptions = options.refetch;
  useEffect(() => {
    if (forbidden) void refetchOptions();
  }, [forbidden, refetchOptions]);

  const refresh = async () => {
    setPulling(true);
    try {
      await Promise.all([analytics.refetch(), options.refetch()]);
    } finally {
      setPulling(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="gap-4 p-4 pb-10"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
      <Text className="text-sm text-gray-600">{featureInfo('analytics', user?.role_id).description}</Text>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        options={options.data}
        showSupervisor={!isSupervisor}
        errors={fieldErrors}
      />
      {options.isError ? (
        <Banner tone="warning" message={`Couldn't load the filter lists. ${toApiError(options.error).message}`} />
      ) : null}

      {updating ? (
        <View className="flex-row items-center justify-center gap-2" accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={colors.brand700} />
          <Text className="text-sm text-gray-600">Updating charts…</Text>
        </View>
      ) : null}

      {analytics.isPending ? (
        <AnalyticsSkeleton />
      ) : error && !data ? (
        error.kind === 'validation' || error.kind === 'forbidden' ? (
          // Bad filters: the fields above show what to fix; Clear Filters gets back to all data.
          <Banner
            message={
              error.kind === 'forbidden'
                ? 'That filter is outside your students. Clear Filters to continue.'
                : error.message
            }
          />
        ) : (
          <ErrorState message={error.message} onRetry={() => void analytics.refetch()} retrying={analytics.isFetching} />
        )
      ) : data ? (
        <>
          {error ? <Banner tone="warning" message={`Showing saved charts. ${error.message}`} /> : null}
          <Charts data={data} />
        </>
      ) : null}
    </ScrollView>
  );
}
