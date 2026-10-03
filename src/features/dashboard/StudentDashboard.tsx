import Ionicons from '@expo/vector-icons/Ionicons';
import type { Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { AttendanceStatus, MeResponse, StudentDashboard as StudentData } from '@/api/types';
import { Banner } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatTime } from '@/lib/datetime';
import { capitalize, formatNumber, TABULAR } from '@/lib/format';
import { hrefForFeature } from '@/navigation/access';
import { openHref } from '@/navigation/targets';
import { colors } from '@/theme/colors';

import { HoursProgressBar } from './HoursProgressBar';

/** "View all" link in a card header, to a tab of this role. */
function CardLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      hitSlop={8}
      className="-my-1 min-h-8 justify-center rounded-lg px-2 active:bg-brand-50">
      <Text className="text-sm font-medium text-brand-700">{label}</Text>
    </Pressable>
  );
}

function AttendanceRow({ label, time, status }: { label: string; time: string | null; status: AttendanceStatus | null }) {
  const timeText = time ? formatTime(time) : '—';
  return (
    <View
      className="min-h-10 flex-row items-center gap-3"
      accessible
      accessibilityLabel={`${label}: ${time ? timeText : 'none'}, ${status ?? 'not submitted'}`}>
      <Text className="w-20 text-sm text-gray-600">{label}</Text>
      <Text className="flex-1 text-base font-medium text-gray-900" style={TABULAR}>
        {timeText}
      </Text>
      {status ? <StatusBadge status={status} /> : <Text className="text-xs text-gray-500">Not submitted</Text>}
    </View>
  );
}

/** Student dashboard: the website's StudentSummary (My Dashboard), in phone order. */
export function StudentDashboard({ data, me }: { data: StudentData | null; me: MeResponse | null }) {
  if (!data) {
    // Same text as the website when no student profile is linked.
    return <Banner tone="warning" message="No student profile is linked to your account yet. Please contact your coordinator." />;
  }

  const { internship, hours, today_attendance: today, reports, recent_reports: recent } = data;
  const attendanceHref = hrefForFeature('attendance', me);
  const reportsHref = hrefForFeature('my-reports', me);

  return (
    <View className="gap-4">
      {/* Hours Rendered + Hours Progress (two web cards, one here) */}
      <Card title="Hours Progress">
        <View className="flex-row items-baseline gap-1.5" accessible accessibilityLabel={`Hours rendered: ${formatNumber(hours.rendered)}${hours.required !== null ? ` of ${formatNumber(hours.required)} required` : ''}`}>
          <Text className="text-3xl font-semibold text-gray-900" style={TABULAR}>
            {formatNumber(hours.rendered)}
          </Text>
          <Text className="text-sm text-gray-500" style={TABULAR}>
            {hours.required !== null ? `of ${formatNumber(hours.required)} required hrs` : 'hrs rendered · No target set yet'}
          </Text>
        </View>
        {hours.required !== null ? (
          <View className="mt-3 gap-2">
            <HoursProgressBar rendered={hours.rendered} required={hours.required} percent={hours.progress_percent} hideCaption />
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500" style={TABULAR}>
                {formatNumber(hours.remaining ?? 0)} hrs remaining
              </Text>
              <Text className="text-xs font-medium text-gray-700" style={TABULAR}>
                {hours.progress_percent ?? 0}%
              </Text>
            </View>
          </View>
        ) : null}
      </Card>

      <Card
        title="Today's Attendance"
        right={attendanceHref ? <CardLink label="Open" onPress={() => openHref(attendanceHref)} /> : undefined}>
        {today ? (
          <View>
            <AttendanceRow label="Time In" time={today.time_in} status={today.time_in_status} />
            <View className="h-px bg-gray-100" />
            <AttendanceRow label="Time Out" time={today.time_out} status={today.time_out_status} />
          </View>
        ) : (
          <Text className="text-sm text-gray-500">You haven&apos;t timed in today.</Text>
        )}
      </Card>

      <Card title="Internship Status" right={<StatusBadge status={internship.status} />}>
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="business-outline" size={16} color={colors.gray500} />
            <Text className="flex-1 text-sm text-gray-900">{internship.company?.name ?? 'No company assigned yet'}</Text>
          </View>
          {internship.company ? (
            <View className="flex-row items-center gap-2">
              <Ionicons name="person-outline" size={16} color={colors.gray500} />
              <Text className="flex-1 text-sm text-gray-900">
                {internship.supervisor ? `Supervisor: ${internship.supervisor.name}` : 'No supervisor assigned yet'}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>

      <Card
        title="Recent Reports"
        right={reportsHref ? <CardLink label="View all" onPress={() => openHref(reportsHref)} /> : undefined}>
        <View
          className="mb-2 flex-row items-center gap-2 rounded-lg bg-amber-50 px-3 py-2"
          accessible
          accessibilityLabel={`Pending Reports: ${reports.pending}, awaiting reviewer feedback`}>
          <Ionicons name="document-text-outline" size={16} color={colors.amber600} />
          <Text className="flex-1 text-sm text-amber-800">
            Pending Reports:{' '}
            <Text className="font-semibold" style={TABULAR}>
              {formatNumber(reports.pending)}
            </Text>{' '}
            · Awaiting reviewer feedback
          </Text>
        </View>
        {recent.length === 0 ? (
          <EmptyState message="No reports submitted yet." />
        ) : (
          recent.map((report, index) => (
            <Pressable
              key={report.id}
              disabled={!reportsHref}
              onPress={() => openHref(`/report/${report.id}` as Href)}
              className={`min-h-12 flex-row items-center gap-3 py-3 active:bg-gray-50 ${index > 0 ? 'border-t border-gray-100' : ''}`}
              accessibilityRole={reportsHref ? 'button' : undefined}
              accessibilityHint={reportsHref ? 'Opens the report' : undefined}
              accessibilityLabel={`${capitalize(report.type)} report, ${formatDate(report.period_start)} to ${formatDate(report.period_end)}, ${report.status}`}>
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-medium text-gray-900">{capitalize(report.type)}</Text>
                <Text className="text-xs text-gray-500">
                  {report.period_start === report.period_end
                    ? formatDate(report.period_start)
                    : `${formatDate(report.period_start)} – ${formatDate(report.period_end)}`}
                </Text>
              </View>
              <StatusBadge status={report.status} />
            </Pressable>
          ))
        )}
      </Card>
    </View>
  );
}
