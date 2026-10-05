import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import { toApiError } from './errors';
import { notificationKeys } from './notifications';
import type { ReviewReport, ReviewReportFilters, ReviewReportResponse, ReviewReportsPage } from './types';

const PER_PAGE = 20;

/** Review comment limit (server: max 2000). */
export const REVIEW_COMMENT_MAX = 2000;

export const reviewKeys = {
  all: ['report-reviews'] as const,
  lists: ['report-reviews', 'list'] as const,
  list: (filters: ReviewReportFilters) => ['report-reviews', 'list', filters] as const,
  detail: (id: number) => ['report-reviews', 'detail', id] as const,
};

export const NO_REVIEW_FILTERS: ReviewReportFilters = { status: null, type: null, studentId: null, search: '' };

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getReviewReports(filters: ReviewReportFilters, cursor: string | null): Promise<ReviewReportsPage> {
  const search = filters.search.trim();
  const { data } = await api.get<ReviewReportsPage>('/report-reviews', {
    params: {
      per_page: PER_PAGE,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.studentId !== null ? { student_id: filters.studentId } : {}),
      ...(search ? { search } : {}),
      ...(cursor ? { cursor } : {}),
    },
  });
  return data;
}

export async function getReviewReport(id: number): Promise<ReviewReport> {
  const { data } = await api.get<{ report: ReviewReport }>(`/report-reviews/${id}`);
  return data.report;
}

export interface ReviewInput {
  id: number;
  /** Blank = no comment. */
  comment: string;
}

export async function reviewReport({ id, comment }: ReviewInput): Promise<ReviewReportResponse> {
  const trimmed = comment.trim();
  const { data } = await api.post<ReviewReportResponse>(`/report-reviews/${id}/review`, { comment: trimmed ? trimmed : null });
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type ListData = InfiniteData<ReviewReportsPage, string | null>;

export function useReviewReports(filters: ReviewReportFilters) {
  return useInfiniteQuery({
    queryKey: reviewKeys.list(filters),
    queryFn: ({ pageParam }) => getReviewReports(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    // Keep the old results on screen while a new search / filter loads.
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

/** A report already loaded by a list, to show the detail at once while it refreshes. */
function fromLists(queryClient: QueryClient, id: number): ReviewReport | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: reviewKeys.lists })) {
    const data = query.state.data as ListData | undefined;
    const report = data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
    if (report) return report;
  }
  return undefined;
}

export function useReviewReport(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: reviewKeys.detail(id ?? 0),
    queryFn: () => getReviewReport(id as number),
    enabled: id !== null,
    placeholderData: () => (id !== null ? fromLists(queryClient, id) : undefined),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/** 422 code report_not_pending ("This report has already been reviewed.") with the fresh report. */
export function alreadyReviewed(error: unknown): ReviewReport | null {
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation' || apiError.code !== 'report_not_pending') return null;
  const report = apiError.body.report;
  return report && typeof report === 'object' && 'id' in report ? (report as ReviewReport) : null;
}

/** Puts the server's fresh report in every list it's on and in its detail. */
function applyFresh(queryClient: QueryClient, fresh: ReviewReport) {
  queryClient.setQueriesData<ListData>({ queryKey: reviewKeys.lists }, (old) =>
    old
      ? { ...old, pages: old.pages.map((page) => ({ ...page, data: page.data.map((row) => (row.id === fresh.id ? fresh : row)) })) }
      : old,
  );
  queryClient.setQueryData(reviewKeys.detail(fresh.id), fresh);
}

/** Everything a review changes: the lists (a "Pending" filter drops it), Home's counts and the bell. */
function refreshAfterReview(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: reviewKeys.lists });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

/** Mark Reviewed (Coordinator / Admin). Callers keep one in flight (no double submit). */
export function useReviewReportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewReport,
    onSuccess: ({ report }) => {
      applyFresh(queryClient, report);
      refreshAfterReview(queryClient);
    },
    onError: (error, input) => {
      const apiError = toApiError(error);
      const fresh = alreadyReviewed(error);
      if (fresh) {
        // Someone else reviewed it meanwhile: show what the server says is true now.
        applyFresh(queryClient, fresh);
        refreshAfterReview(queryClient);
      } else if (apiError.kind === 'not_found') {
        // Deleted by the student meanwhile.
        queryClient.setQueriesData<ListData>({ queryKey: reviewKeys.lists }, (old) =>
          old ? { ...old, pages: old.pages.map((page) => ({ ...page, data: page.data.filter((row) => row.id !== input.id) })) } : old,
        );
        refreshAfterReview(queryClient);
        void queryClient.invalidateQueries({ queryKey: reviewKeys.detail(input.id) });
      } else if (apiError.kind === 'network' || apiError.kind === 'timeout' || apiError.kind === 'forbidden') {
        // It may have reached the server before the connection dropped, or the role changed: re-check.
        refreshAfterReview(queryClient);
        void queryClient.invalidateQueries({ queryKey: reviewKeys.detail(input.id) });
      }
    },
  });
}
