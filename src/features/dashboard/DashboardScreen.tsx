import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { dashboardKeys, useDashboard } from '@/api/dashboard';
import { toApiError } from '@/api/errors';
import { ROLE_STUDENT } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { HomeGreeting } from '@/components/HomeGreeting';
import { Banner } from '@/components/ui/Banner';
import { ErrorState } from '@/components/ui/ErrorState';
import { TermBar } from '@/features/terms/TermSwitcher';
import { colors } from '@/theme/colors';

import { DashboardSkeleton } from './DashboardSkeleton';
import { StaffDashboard } from './StaffDashboard';
import { StudentDashboard } from './StudentDashboard';
import { SupervisorDashboard } from './SupervisorDashboard';

/**
 * Home tab for every role: GET /dashboard, which the server shapes for the token's role
 * (website: Dashboard/Index.jsx "Overview"). Pull to refresh; refreshes stale data on focus.
 */
export function DashboardScreen() {
  const { me, user } = useAuth();
  const queryClient = useQueryClient();
  const dashboard = useDashboard();
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void queryClient.refetchQueries({ queryKey: dashboardKeys.dashboard, stale: true, type: 'active' });
    }, [queryClient]),
  );

  const refresh = async () => {
    setPulling(true);
    try {
      await dashboard.refetch();
    } finally {
      setPulling(false);
    }
  };

  const data = dashboard.data;
  let body: React.ReactNode;

  if (dashboard.isPending) {
    body = <DashboardSkeleton grid={user?.role_id !== ROLE_STUDENT} />;
  } else if (!data) {
    body = (
      <ErrorState
        message={toApiError(dashboard.error).message}
        onRetry={() => void dashboard.refetch()}
        retrying={dashboard.isFetching}
      />
    );
  } else {
    const common = { actionItems: data.action_items, recentActivity: data.recent_activity, me };
    switch (data.role_id) {
      case 1:
        body = <StudentDashboard data={data.student} me={me} />;
        break;
      case 3:
        body = <SupervisorDashboard kpis={data.kpis} students={data.supervised_students} {...common} />;
        break;
      case 2:
        body = <StaffDashboard roleId={2} kpis={data.kpis} {...common} />;
        break;
      case 4:
        body = <StaffDashboard roleId={4} kpis={data.kpis} {...common} />;
        break;
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[colors.brand700]} />}>
      <HomeGreeting />
      {/* Supervisors / Coordinators / Admins: which term Home shows (renders nothing for students). */}
      <TermBar />
      {data && dashboard.isRefetchError ? (
        <Banner tone="warning" message={`Showing saved data. ${toApiError(dashboard.error).message}`} />
      ) : null}
      <View>{body}</View>
    </ScrollView>
  );
}
