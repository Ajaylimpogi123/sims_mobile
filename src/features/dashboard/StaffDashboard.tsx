import { View } from 'react-native';

import type { ActionItem, ActivityItem, AdminKpis, CoordinatorKpis, MeResponse } from '@/api/types';
import { formatNumber } from '@/lib/format';
import { hrefForFeature, type FeatureKey } from '@/navigation/access';

import { ActionItems } from './ActionItems';
import { AnalyticsLink } from './AnalyticsLink';
import { RecentActivity } from './RecentActivity';
import { KpiGrid, type StatCardProps } from './StatCard';

type Kpis = StatCardProps & { key: string };

/** The website's CoordinatorSummary cards, in the same order with the same links. */
function coordinatorCards(kpis: CoordinatorKpis, href: (key: FeatureKey) => StatCardProps['href']): Kpis[] {
  return [
    { key: 'students', title: 'Total Students', value: kpis.total_students.value, trend: kpis.total_students.trend, trendLabel: 'vs last month', subtitle: 'All registered students', icon: 'school-outline', tone: 'blue' },
    { key: 'active', title: 'Active Internships', value: kpis.active_internship_assignments.value, subtitle: 'Currently ongoing', icon: 'briefcase-outline', tone: 'emerald', href: href('students') },
    { key: 'companies', title: 'Active Companies', value: kpis.companies.value, subtitle: 'Partner companies', icon: 'business-outline', tone: 'purple', href: href('companies') },
    { key: 'supervisors', title: 'Active Supervisors', value: kpis.active_supervisors.value, subtitle: 'Assigned/active supervisors', icon: 'person-outline', tone: 'indigo' },
    { key: 'no-company', title: 'Without Company', value: kpis.students_without_company.value, subtitle: 'Students needing assignment', icon: 'person-remove-outline', tone: 'orange', href: href('students') },
    // Coordinators can't approve attendance, so this card isn't a link (same as the website).
    { key: 'approvals', title: 'Pending Approvals', value: kpis.pending_approvals.value, subtitle: 'Time-in / time-out requests', icon: 'checkmark-done-outline', tone: 'amber' },
    { key: 'attendance', title: 'Attendance Summary', value: `${formatNumber(kpis.attendance_summary.present)} present`, subtitle: `${formatNumber(kpis.attendance_summary.rejected)} rejected entries`, icon: 'trending-up-outline', tone: 'sky' },
    { key: 'completion', title: 'Completion Progress', value: `${formatNumber(kpis.internship_completion_progress.value, 1)}%`, subtitle: 'Average across active students', icon: 'stats-chart-outline', tone: 'teal', href: href('progress') },
    { key: 'reports', title: 'Reports Awaiting Review', value: kpis.reports_awaiting_review.value, subtitle: 'Pending internship reports', icon: 'document-text-outline', tone: 'cyan', href: href('report-reviews') },
    { key: 'attention', title: 'Requiring Attention', value: kpis.students_requiring_attention.value, subtitle: 'Repeated attendance rejections', icon: 'alert-circle-outline', tone: 'red', href: href('attendance-monitoring') },
  ];
}

/** The website's AdminSummary cards, in the same order with the same links. */
function adminCards(kpis: AdminKpis, href: (key: FeatureKey) => StatCardProps['href']): Kpis[] {
  return [
    { key: 'students', title: 'Total Students', value: kpis.total_students.value, trend: kpis.total_students.trend, trendLabel: 'vs last month', subtitle: 'All registered students', icon: 'school-outline', tone: 'blue' },
    { key: 'companies', title: 'Active Companies', value: kpis.total_companies.value, subtitle: 'Partner companies', icon: 'business-outline', tone: 'purple' },
    { key: 'supervisors', title: 'Total Supervisors', value: kpis.total_supervisors.value, subtitle: 'Active supervisor accounts', icon: 'person-outline', tone: 'indigo' },
    { key: 'active', title: 'Active Internships', value: kpis.active_internship_assignments.value, subtitle: 'Currently ongoing', icon: 'briefcase-outline', tone: 'emerald', href: href('students') },
    { key: 'completed', title: 'Completed Internships', value: kpis.completed_internships.value, subtitle: 'Finished this program', icon: 'checkmark-circle-outline', tone: 'green' },
    { key: 'approvals', title: 'Pending Approvals', value: kpis.pending_approvals.value, subtitle: 'Time-in / time-out requests', icon: 'checkmark-done-outline', tone: 'amber', href: href('approvals') },
    { key: 'attendance', title: 'Attendance Summary', value: `${formatNumber(kpis.attendance_summary.present)} present`, subtitle: `${formatNumber(kpis.attendance_summary.rejected)} rejected entries`, icon: 'trending-up-outline', tone: 'sky' },
    { key: 'nearing', title: 'Nearing Completion', value: kpis.students_nearing_completion.value, subtitle: '≥90% of required hours', icon: 'list-outline', tone: 'teal', href: href('progress') },
    { key: 'issues', title: 'Attendance Issues', value: kpis.students_with_attendance_issues.value, subtitle: 'Students with repeated rejections', icon: 'alert-circle-outline', tone: 'red', href: href('attendance-monitoring') },
    { key: 'evaluations', title: 'Pending Evaluations', value: kpis.pending_supervisor_evaluations.value, subtitle: 'Draft supervisor evaluations', icon: 'clipboard-outline', tone: 'fuchsia', href: href('evaluations') },
  ];
}

type Props = { actionItems: ActionItem[]; recentActivity: ActivityItem[]; me: MeResponse | null } & (
  | { roleId: 2; kpis: CoordinatorKpis }
  | { roleId: 4; kpis: AdminKpis }
);

/** Coordinator and Administrator dashboards (website: CoordinatorSummary / AdminSummary + action items + activity). */
export function StaffDashboard(props: Props) {
  const { actionItems, recentActivity, me } = props;
  // Links follow this user's navigation (role + /me flags); a card the role can't open isn't tappable.
  const href = (key: FeatureKey) => hrefForFeature(key, me);
  const cards = props.roleId === 2 ? coordinatorCards(props.kpis, href) : adminCards(props.kpis, href);

  return (
    <View className="gap-4">
      <AnalyticsLink me={me} />
      <KpiGrid items={cards} />
      <ActionItems items={actionItems} me={me} />
      <RecentActivity items={recentActivity} me={me} />
    </View>
  );
}
