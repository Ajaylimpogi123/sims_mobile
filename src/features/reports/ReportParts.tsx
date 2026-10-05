import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type { Report, ReportFilters, ReportStatus, ReportType } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/FilterChip';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/lib/datetime';
import { colors } from '@/theme/colors';

import { formatPeriod, STATUS_LABEL, TYPE_LABEL } from './format';

/**
 * Report pieces shared by the student's My Reports (Module 7) and staff Report Reviews (Module 11).
 */

/** All / Pending / Reviewed | Daily / Weekly (the API's status and type filters). */
export function ReportFilterChips<F extends ReportFilters>({ filters, onChange }: { filters: F; onChange: (filters: F) => void }) {
  const statuses: (ReportStatus | null)[] = [null, 'pending', 'reviewed'];
  const types: ReportType[] = ['daily', 'weekly'];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-2 px-4" accessibilityLabel="Filter reports">
      {statuses.map((status) => (
        <FilterChip
          key={status ?? 'all'}
          label={status ? STATUS_LABEL[status] : 'All'}
          selected={filters.status === status}
          onPress={() => onChange({ ...filters, status })}
        />
      ))}
      <View className="mx-1 h-5 w-px bg-gray-300" />
      {types.map((type) => (
        <FilterChip
          key={type}
          label={TYPE_LABEL[type]}
          selected={filters.type === type}
          // Tap the selected type again to show both.
          onPress={() => onChange({ ...filters, type: filters.type === type ? null : type })}
        />
      ))}
    </ScrollView>
  );
}

export function ReportMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Ionicons name={icon} size={16} color={colors.gray500} />
      <Text className="flex-1 text-sm text-gray-600">{text}</Text>
    </View>
  );
}

/** Period + status, type and submitted time; `children` adds lines (e.g. the student). */
export function ReportSummaryCard({ report, children }: { report: Report; children?: ReactNode }) {
  return (
    <Card>
      <View className="flex-row items-start justify-between gap-3">
        <Text accessibilityRole="header" className="flex-1 text-xl font-semibold text-gray-900">
          {formatPeriod(report)}
        </Text>
        <StatusBadge status={report.status} />
      </View>
      <View className="mt-3 gap-1.5">
        {children}
        <ReportMeta icon="document-text-outline" text={`${TYPE_LABEL[report.type]} report`} />
        <ReportMeta icon="time-outline" text={`Submitted ${formatDateTime(report.created_at)}`} />
      </View>
    </Card>
  );
}

export function ReportContentCard({ report }: { report: Report }) {
  return (
    <Card title="Accomplishment Details">
      <Text selectable className="text-base leading-6 text-gray-900">
        {report.content}
      </Text>
    </Card>
  );
}

/** "Reviewer Comment" once reviewed (website label), or "Not reviewed yet." */
export function ReviewerCard({ report }: { report: Report }) {
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
