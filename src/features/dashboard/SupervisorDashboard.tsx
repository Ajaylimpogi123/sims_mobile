import { View } from 'react-native';

import type { ActionItem, ActivityItem, MeResponse, SupervisedStudentRow, SupervisorKpis } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { hrefForFeature } from '@/navigation/access';

import { ActionItems } from './ActionItems';
import { AnalyticsLink } from './AnalyticsLink';
import { HoursProgressBar } from './HoursProgressBar';
import { RecentActivity } from './RecentActivity';
import { KpiGrid } from './StatCard';
import { Text } from '@/components/ui/Text';

interface Props {
  kpis: SupervisorKpis;
  students: SupervisedStudentRow[];
  actionItems: ActionItem[];
  recentActivity: ActivityItem[];
  me: MeResponse | null;
}

/** Supervisor dashboard: the website's SupervisorSummary (same 8 cards, links and "Your Students"). */
export function SupervisorDashboard({ kpis, students, actionItems, recentActivity, me }: Props) {
  const href = (key: Parameters<typeof hrefForFeature>[0]) => hrefForFeature(key, me);

  return (
    <View className="gap-4">
      <AnalyticsLink me={me} />

      <KpiGrid
        items={[
          { key: 'assigned', title: 'Assigned Students', value: kpis.assigned_students.value, subtitle: 'Assigned to you', icon: 'people-outline', tone: 'blue' },
          { key: 'active', title: 'Active Internships', value: kpis.active_internships.value, subtitle: 'Currently ongoing', icon: 'briefcase-outline', tone: 'emerald', href: href('progress') },
          { key: 'today', title: "Today's Attendance", value: kpis.todays_attendance.value, subtitle: 'Present today', icon: 'calendar-outline', tone: 'sky' },
          { key: 'approvals', title: 'Pending Approvals', value: kpis.pending_attendance_approvals.value, subtitle: 'Awaiting your action', icon: 'checkmark-done-outline', tone: 'amber', href: href('approvals') },
          { key: 'reports', title: 'Reports Awaiting Review', value: kpis.reports_awaiting_review.value, subtitle: 'Awaiting your review', icon: 'document-text-outline', tone: 'cyan', href: href('report-reviews') },
          { key: 'pending-evals', title: 'Pending Evaluations', value: kpis.pending_evaluations.value, subtitle: 'Still in draft', icon: 'clipboard-outline', tone: 'fuchsia', href: href('evaluations') },
          { key: 'done-evals', title: 'Completed Evaluations', value: kpis.completed_evaluations.value, subtitle: 'Submitted or locked', icon: 'checkmark-circle-outline', tone: 'green', href: href('evaluations') },
          { key: 'attention', title: 'Requiring Attention', value: kpis.students_requiring_attention.value, subtitle: 'Repeated attendance rejections', icon: 'alert-circle-outline', tone: 'red', href: href('attendance-monitoring') },
        ]}
      />

      <Card title="Your Students">
        {students.length === 0 ? (
          <EmptyState message="No students are assigned to you yet." />
        ) : (
          students.map((student, index) => (
            <View key={student.id} className={`gap-2 py-3 ${index > 0 ? 'border-t border-gray-100' : ''}`}>
              <View className="flex-row items-center gap-3">
                <Text className="flex-1 text-sm font-medium text-gray-900" numberOfLines={1}>
                  {student.name ?? 'Unnamed student'}
                </Text>
                <StatusBadge status={student.internship_status} />
              </View>
              <HoursProgressBar rendered={student.rendered_hours} required={student.required_hours} percent={student.progress_percent} />
            </View>
          ))
        )}
      </Card>

      <ActionItems items={actionItems} me={me} />
      <RecentActivity items={recentActivity} me={me} />
    </View>
  );
}
