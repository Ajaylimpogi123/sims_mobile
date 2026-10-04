import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import { toApiError } from './errors';
import { notificationKeys } from './notifications';
import type {
  ApprovalCountResponse,
  ApprovalDecision,
  ApprovalDecisionResponse,
  ApprovalItem,
  ApprovalResponse,
  ApprovalsPage,
  AttendanceLeg,
} from './types';

const PER_PAGE = 20;

export const approvalKeys = {
  all: ['approvals'] as const,
  list: ['approvals', 'list'] as const,
  count: ['approvals', 'count'] as const,
  detail: (id: number) => ['approvals', 'detail', id] as const,
};

/** Reject reason limit (server: max 500). */
export const REJECT_REASON_MAX = 500;

const LEG_PATH: Record<AttendanceLeg, string> = { time_in: 'time-in', time_out: 'time-out' };

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getApprovals(cursor: string | null): Promise<ApprovalsPage> {
  const { data } = await api.get<ApprovalsPage>('/approvals', {
    params: { per_page: PER_PAGE, ...(cursor ? { cursor } : {}) },
  });
  return data;
}

export async function getApprovalCount(): Promise<number> {
  const { data } = await api.get<ApprovalCountResponse>('/approvals/count');
  return data.count;
}

export async function getApproval(id: number): Promise<ApprovalItem> {
  const { data } = await api.get<ApprovalResponse>(`/approvals/${id}`);
  return data.data;
}

export interface DecisionInput {
  id: number;
  leg: AttendanceLeg;
  decision: ApprovalDecision;
  /** Reject only; blank = no reason. */
  reason?: string;
}

export async function decideApproval({ id, leg, decision, reason }: DecisionInput): Promise<ApprovalDecisionResponse> {
  const trimmed = reason?.trim();
  const body = decision === 'reject' && trimmed ? { reason: trimmed } : {};
  const { data } = await api.post<ApprovalDecisionResponse>(`/attendance/${id}/${LEG_PATH[leg]}/${decision}`, body);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type ListData = InfiniteData<ApprovalsPage, string | null>;

export function useApprovals() {
  return useInfiniteQuery({
    queryKey: approvalKeys.list,
    queryFn: ({ pageParam }) => getApprovals(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    staleTime: 15_000,
  });
}

/**
 * Pending count for the Approvals tab badge. Never polls by itself: the one session poller
 * (useBadgePolling in RoleTabs) refreshes it together with the bell.
 */
export function useApprovalCount(enabled: boolean) {
  return useQuery({ queryKey: approvalKeys.count, queryFn: getApprovalCount, staleTime: 15_000, enabled });
}

/** One record (a notification target, or a card opened from the list, shown at once from the list cache). */
export function useApproval(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: approvalKeys.detail(id ?? 0),
    queryFn: () => getApproval(id!),
    enabled: id !== null,
    staleTime: 15_000,
    placeholderData: () => (id !== null ? findInList(queryClient, id) : undefined),
  });
}

function findInList(queryClient: QueryClient, id: number): ApprovalItem | undefined {
  const list = queryClient.getQueryData<ListData>(approvalKeys.list);
  for (const page of list?.pages ?? []) {
    const item = page.data.find((row) => row.id === id);
    if (item) return item;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

/** Puts the server's fresh record in the caches; a record with nothing left pending leaves the list. */
function applyFresh(queryClient: QueryClient, fresh: ApprovalItem) {
  queryClient.setQueryData<ListData>(approvalKeys.list, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data:
              fresh.pending_legs.length === 0
                ? page.data.filter((row) => row.id !== fresh.id)
                : page.data.map((row) => (row.id === fresh.id ? fresh : row)),
          })),
        }
      : old,
  );
  queryClient.setQueryData<ApprovalItem>(approvalKeys.detail(fresh.id), fresh);
}

function removeRecord(queryClient: QueryClient, id: number) {
  queryClient.setQueryData<ListData>(approvalKeys.list, (old) =>
    old ? { ...old, pages: old.pages.map((page) => ({ ...page, data: page.data.filter((row) => row.id !== id) })) } : old,
  );
}

function refreshAfterDecision(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: approvalKeys.list });
  void queryClient.invalidateQueries({ queryKey: approvalKeys.count });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

/** 422 code attendance_rule ("This time-in is not pending review."): the fresh record, if the server sent it. */
export function ruleRefusalRecord(error: unknown): ApprovalItem | null {
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation' || apiError.code !== 'attendance_rule') return null;
  const attendance = apiError.body.attendance;
  return attendance && typeof attendance === 'object' && 'pending_legs' in attendance ? (attendance as ApprovalItem) : null;
}

export function isRuleRefusal(error: unknown): boolean {
  const apiError = toApiError(error);
  return apiError.kind === 'validation' && apiError.code === 'attendance_rule';
}

/** Approve / reject one leg. Callers keep one decision per record in flight (no double submit). */
export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: decideApproval,
    onSuccess: (response) => {
      applyFresh(queryClient, response.attendance);
      refreshAfterDecision(queryClient);
    },
    onError: (error, input) => {
      const apiError = toApiError(error);
      const fresh = ruleRefusalRecord(error);
      if (fresh) {
        // Someone else decided it meanwhile: show what the server says is true now.
        applyFresh(queryClient, fresh);
        refreshAfterDecision(queryClient);
      } else if (isRuleRefusal(error)) {
        refreshAfterDecision(queryClient);
        void queryClient.invalidateQueries({ queryKey: approvalKeys.detail(input.id) });
      } else if (apiError.kind === 'not_found') {
        // Gone, or no longer this supervisor's student.
        removeRecord(queryClient, input.id);
        refreshAfterDecision(queryClient);
      } else if (apiError.kind === 'network' || apiError.kind === 'timeout') {
        // The decision may have reached the server before the connection dropped: re-check.
        refreshAfterDecision(queryClient);
        void queryClient.invalidateQueries({ queryKey: approvalKeys.detail(input.id) });
      }
    },
  });
}
