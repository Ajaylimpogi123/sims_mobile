import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';

import { SegmentedControl } from '@/components/ui/SegmentedControl';

import { ReportReviewsList } from '../reportReviews/ReportReviewsList';

import { StudentList, type MonitoringKind } from './StudentListScreen';

type TabView = MonitoringKind | 'reports';

const OPTIONS: { value: TabView; label: string }[] = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'progress', label: 'Progress' },
  { value: 'reports', label: 'Reports' },
];

const TITLE: Record<TabView, string> = {
  attendance: 'Attendance Monitoring',
  progress: 'Progress Monitoring',
  reports: 'Report Reviews',
};

function isView(value: unknown): value is TabView {
  return value === 'attendance' || value === 'progress' || value === 'reports';
}

/**
 * The supervisor's Students tab: the website's sidebar pages Attendance Monitoring, Progress
 * Monitoring and Report Reviews (view only) behind one switch (supervisors have no More).
 * `?view=attendance|progress|reports` (a link, see HOSTED_IN in access.ts) picks one.
 */
export function SupervisorMonitoringTab() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<TabView>(() => (isView(params.view) ? params.view : 'attendance'));

  useEffect(() => {
    if (!isView(params.view)) return;
    setView(params.view);
    router.setParams({ view: undefined });
  }, [params.view, router]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: TITLE[view] });
  }, [navigation, view]);

  const top = <SegmentedControl label="View" options={OPTIONS} value={view} onChange={setView} />;

  if (view === 'reports') return <ReportReviewsList top={top} />;
  return <StudentList key={view} kind={view} top={top} />;
}
