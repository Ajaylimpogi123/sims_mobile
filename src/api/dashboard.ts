import { keepPreviousData, useQuery, type QueryClient } from '@tanstack/react-query';

import { termKey, termParams, useTermParam, type TermKey } from '@/terms/selected-term';

import { api } from './client';
import type { AnalyticsFilterOptions, AnalyticsFilters, AnalyticsResponse, DashboardResponse } from './types';

/** `dashboard` and `filterOptions` are prefixes: invalidating them refreshes every term's copy. */
export const dashboardKeys = {
  dashboard: ['dashboard'] as const,
  dashboardFor: (term: TermKey) => ['dashboard', term] as const,
  analytics: (filters: AnalyticsFilters, term: TermKey) => ['analytics', filters, term] as const,
  filterOptions: ['analytics', 'filter-options'] as const,
  filterOptionsFor: (term: TermKey) => ['analytics', 'filter-options', term] as const,
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

/** termId null = the current term (always for students: the server uses their own term). */
export async function getDashboard(termId: number | null = null): Promise<DashboardResponse> {
  const { data } = await api.get<DashboardResponse>('/dashboard', { params: termParams(termId) });
  return data;
}

/** Only set filters are sent; the server applies its defaults (e.g. last 30 days for trends). */
export async function getAnalytics(filters: AnalyticsFilters, termId: number | null = null): Promise<AnalyticsResponse> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== null && value !== ''));
  const { data } = await api.get<AnalyticsResponse>('/analytics', { params: { ...params, ...termParams(termId) } });
  return data;
}

export async function getAnalyticsFilterOptions(termId: number | null = null): Promise<AnalyticsFilterOptions> {
  const { data } = await api.get<AnalyticsFilterOptions>('/analytics/filter-options', { params: termParams(termId) });
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** The signed-in user's role dashboard (the server decides which one from the token). */
export function useDashboard() {
  const termId = useTermParam();
  return useQuery({ queryKey: dashboardKeys.dashboardFor(termKey(termId)), queryFn: () => getDashboard(termId), staleTime: 30_000 });
}

/** Analytics for the chosen filters; the previous charts stay on screen while new filters load. */
export function useAnalytics(filters: AnalyticsFilters) {
  const termId = useTermParam();
  return useQuery({
    queryKey: dashboardKeys.analytics(filters, termKey(termId)),
    queryFn: () => getAnalytics(filters, termId),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useAnalyticsFilterOptions() {
  const termId = useTermParam();
  return useQuery({
    queryKey: dashboardKeys.filterOptionsFor(termKey(termId)),
    queryFn: () => getAnalyticsFilterOptions(termId),
    staleTime: 5 * 60_000,
  });
}

/** Marks a dashboard activity row read in the cached dashboard (after POST /notifications/{id}/read). */
export function setActivityRead(queryClient: QueryClient, id: number, readAt: string) {
  queryClient.setQueriesData<DashboardResponse>({ queryKey: dashboardKeys.dashboard }, (old) =>
    old
      ? {
          ...old,
          recent_activity: old.recent_activity.map((item) => (item.id === id && !item.read_at ? { ...item, read_at: readAt } : item)),
        }
      : old,
  );
}
