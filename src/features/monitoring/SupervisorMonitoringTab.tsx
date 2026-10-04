import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';

import { SegmentedControl } from '@/components/ui/SegmentedControl';

import { StudentList, type MonitoringKind } from './StudentListScreen';

const OPTIONS: { value: MonitoringKind; label: string }[] = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'progress', label: 'Progress' },
];

const TITLE: Record<MonitoringKind, string> = { attendance: 'Attendance Monitoring', progress: 'Progress Monitoring' };

/**
 * The supervisor's Students tab: the website's two sidebar pages, Attendance Monitoring and
 * Progress Monitoring, behind one switch (supervisors have no More). `?view=progress` /
 * `?view=attendance` (a link, see HOSTED_IN in access.ts) picks one.
 */
export function SupervisorMonitoringTab() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ view?: string }>();
  const [kind, setKind] = useState<MonitoringKind>('attendance');

  useEffect(() => {
    if (params.view !== 'attendance' && params.view !== 'progress') return;
    setKind(params.view);
    router.setParams({ view: undefined });
  }, [params.view, router]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: TITLE[kind] });
  }, [navigation, kind]);

  return (
    <StudentList
      key={kind}
      kind={kind}
      top={<SegmentedControl label="View" options={OPTIONS} value={kind} onChange={setKind} />}
    />
  );
}
