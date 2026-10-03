import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { AnalyticsFilterOptions, AnalyticsFilters, AnalyticsResponse, DashboardResponse } from './types';

export const dashboardKeys = {
  dashboard: ['dashboard'] as const,
  analytics: (filters: AnalyticsFilters) => ['analytics', filters] as const,
  filterOptions: ['analytics', 'filter-options'] as const,
};

export const EMPTY_ANALYTICS_FILTERS: AnalyticsFilters = {
  date_from: null,
  date_to: null,
  company_id: null,
  supervisor_id: null,
  student_id: null,
};

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getDashboard(): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>('/dashboard');
  return data;
}

/** Only set filters are sent; the server applies its defaults (e.g. last 30 days for trends). */
export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResponse> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null && value !== ''));
  const { data } = await api.get<AnalyticsResponse>('/analytics', { params });
  return data;
}

export async function getAnalyticsFilterOptions(): Promise<AnalyticsFilterOptions> {
  const { data } = await api.get<AnalyticsFilterOptions>('/analytics/filter-options');
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The signed-in user's role dashboard (the server decides which one from the token). */
export function useDashboard() {
  return useQuery({ queryKey: dashboardKeys.dashboard, queryFn: getDashboard, staleTime: 30_000 });
}

/** Analytics for the chosen filters; the previous charts stay on screen while new filters load. */
export function useAnalytics(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: dashboardKeys.analytics(filters),
    queryFn: () => getAnalytics(filters),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useAnalyticsFilterOptions() {
  return useQuery({ queryKey: dashboardKeys.filterOptions, queryFn: getAnalyticsFilterOptions, staleTime: 5 * 60_000 });
}

/** Marks a dashboard activity row read in the cached dashboard (after POST /notifications/{id}/read). */
export function setActivityRead(queryClient: QueryClient, id: number, readAt: string) {
  queryClient.setQueryData<DashboardResponse>(dashboardKeys.dashboard, (old) =>
    old
      ? {
          ...old,
          recent_activity: old.recent_activity.map((item) => (item.id === id && !item.read_at ? { ...item, read_at: readAt } : item)),
        }
      : old,
  );
}
