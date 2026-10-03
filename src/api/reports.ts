import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import { toApiError } from './errors';
import { notificationKeys } from './notifications';
import type { Report, ReportFilters, ReportSaveResponse, ReportsPage, ReportType } from './types';

const PER_PAGE = 20;
/** Uploading an attachment over mobile data takes longer than a normal request. */
const UPLOAD_TIMEOUT_MS = 60_000;

export const reportKeys = {
  all: ['reports'] as const,
  lists: ['reports', 'list'] as const,
  list: (filters: ReportFilters) => ['reports', 'list', filters] as const,
  detail: (id: number) => ['reports', 'detail', id] as const,
};

export const NO_REPORT_FILTERS: ReportFilters = { type: null, status: null };

/** A file picked on the phone, ready to upload (sent as multipart/form-data). */
export interface PickedFile {
  /** file:// URI */
  uri: string;
  name: string;
  /** image/jpeg, image/png or application/pdf */
  mimeType: string;
  /** bytes, when known */
  size: number | null;
}

/** What the create / edit form sends. Every field is sent on update too (full replace, like the website). */
export interface ReportInput {
  type: ReportType;
  period_start: string;
  /** Equal to period_start for a daily report. */
  period_end: string;
  content: string;
  /** A new file (replaces the current one on update). */
  attachment: PickedFile | null;
  /** Update only: remove the current file without replacing it. Never together with `attachment`. */
  removeAttachment: boolean;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getReports(filters: ReportFilters, cursor: string | null, perPage = PER_PAGE): Promise<ReportsPage> {
  const { data } = await api.get<ReportsPage>('/reports', {
    params: {
      per_page: perPage,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(cursor ? { cursor } : {}),
    },
  });
  return data;
}

export async function getReport(id: number): Promise<Report> {
  const { data } = await api.get<{ report: Report }>(`/reports/${id}`);
  return data.report;
}

function toFormData(input: ReportInput, method?: 'PATCH'): FormData {
  const form = new FormData();
  if (method) form.append('_method', method);
  form.append('type', input.type);
  form.append('period_start', input.period_start);
  form.append('period_end', input.type === 'daily' ? input.period_start : input.period_end);
  form.append('content', input.content);
  if (input.attachment) {
    // React Native's FormData takes a { uri, name, type } file descriptor.
    form.append('attachment', {
      uri: input.attachment.uri,
      name: input.attachment.name,
      type: input.attachment.mimeType,
    } as unknown as Blob);
  } else if (method && input.removeAttachment) {
    form.append('remove_attachment', '1');
  }
  return form;
}

export async function createReport(input: ReportInput): Promise<ReportSaveResponse> {
  // No Content-Type: axios lets React Native set multipart/form-data with its boundary.
  const { data } = await api.post<ReportSaveResponse>('/reports', toFormData(input), { timeout: UPLOAD_TIMEOUT_MS });
  return data;
}

/** Multipart can't go in a real PATCH, so it's a POST with _method=PATCH (the API's supported way). */
export async function updateReport(id: number, input: ReportInput): Promise<ReportSaveResponse> {
  const { data } = await api.post<ReportSaveResponse>(`/reports/${id}`, toFormData(input, 'PATCH'), { timeout: UPLOAD_TIMEOUT_MS });
  return data;
}

export async function deleteReport(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/reports/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useReports(filters: ReportFilters) {
  return useInfiniteQuery({
    queryKey: reportKeys.list(filters),
    queryFn: ({ pageParam }) => getReports(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    staleTime: 30_000,
  });
}

/** A report already loaded by a list, to show the detail at once while it refreshes. */
function fromLists(queryClient: QueryClient, id: number): { report: Report; updatedAt: number } | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: reportKeys.lists })) {
    const data = query.state.data as InfiniteData<ReportsPage> | undefined;
    const report = data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
    if (report) return { report, updatedAt: query.state.dataUpdatedAt };
  }
  return undefined;
}

export function useReport(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: reportKeys.detail(id ?? 0),
    queryFn: () => getReport(id as number),
    enabled: id !== null,
    initialData: () => (id !== null ? fromLists(queryClient, id)?.report : undefined),
    initialDataUpdatedAt: () => (id !== null ? fromLists(queryClient, id)?.updatedAt : undefined),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** 422 code report_not_pending ("This report has already been reviewed…") carries the fresh report. */
export function notPendingReport(error: unknown): Report | null {
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation' || apiError.code !== 'report_not_pending') return null;
  const report = apiError.body.report;
  return report && typeof report === 'object' && 'id' in report ? (report as Report) : null;
}

/** Everything a create / update / delete changes: the lists, the Home dashboard and the bell. */
export function refreshAfterReportChange(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: reportKeys.lists });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

/** The server refused because the report changed under us: show what it says is true now. */
function applyRefusal(queryClient: QueryClient, id: number | null, error: unknown) {
  const fresh = notPendingReport(error);
  if (fresh) {
    queryClient.setQueryData(reportKeys.detail(fresh.id), fresh);
    refreshAfterReportChange(queryClient);
  } else if (id !== null && toApiError(error).kind === 'not_found') {
    queryClient.removeQueries({ queryKey: reportKeys.detail(id), exact: true });
    refreshAfterReportChange(queryClient);
  }
}

export function useCreateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createReport,
    onSuccess: ({ report }) => {
      queryClient.setQueryData(reportKeys.detail(report.id), report);
      refreshAfterReportChange(queryClient);
    },
  });
}

export function useUpdateReport(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportInput) => updateReport(id, input),
    onSuccess: ({ report }) => {
      queryClient.setQueryData(reportKeys.detail(report.id), report);
      refreshAfterReportChange(queryClient);
    },
    onError: (error) => applyRefusal(queryClient, id, error),
  });
}

export function useDeleteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteReport(id),
    // The detail cache is left to expire: the screen showing it is closing, and removing it now would refetch a 404.
    onSuccess: () => refreshAfterReportChange(queryClient),
    onError: (error, id) => applyRefusal(queryClient, id, error),
  });
}
