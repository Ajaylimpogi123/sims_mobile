import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import { toApiError } from './errors';
import { notificationKeys } from './notifications';
import type {
  CriterionWriteResponse,
  EvaluableStudent,
  EvaluationCriteriaResponse,
  EvaluationDetail,
  EvaluationFilters,
  EvaluationResponseInput,
  EvaluationsPage,
  EvaluationSummary,
  EvaluationWriteResponse,
  ManagedCriterion,
} from './types';

const PER_PAGE = 20;

/** Server limits (EvaluationService::rules, EvaluationCriteriaController). */
export const EVALUATION_TEXT_MAX = 5000;
export const RESPONSE_COMMENT_MAX = 2000;
export const CRITERION_LABEL_MAX = 255;
export const CRITERION_DESCRIPTION_MAX = 2000;

export const evaluationKeys = {
  all: ['evaluations'] as const,
  lists: ['evaluations', 'list'] as const,
  list: (filters: EvaluationFilters) => ['evaluations', 'list', filters] as const,
  detail: (id: number) => ['evaluations', 'detail', id] as const,
  criteria: ['evaluations', 'criteria'] as const,
  students: ['evaluations', 'students'] as const,
  managedCriteria: ['evaluation-criteria'] as const,
};

export const NO_EVALUATION_FILTERS: EvaluationFilters = { status: null, studentId: null, search: '' };

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getEvaluations(filters: EvaluationFilters, cursor: string | null): Promise<EvaluationsPage> {
  const search = filters.search.trim();
  const { data } = await api.get<EvaluationsPage>('/evaluations', {
    params: {
      per_page: PER_PAGE,
      ...(filters.studentId !== null ? { student_id: filters.studentId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(search ? { search } : {}),
      ...(cursor ? { cursor } : {}),
    },
  });
  return data;
}

export async function getEvaluation(id: number): Promise<EvaluationDetail> {
  const { data } = await api.get<{ evaluation: EvaluationDetail }>(`/evaluations/${id}`);
  return data.evaluation;
}

export async function getEvaluationCriteria(): Promise<EvaluationCriteriaResponse> {
  const { data } = await api.get<EvaluationCriteriaResponse>('/evaluations/criteria');
  return data;
}

export async function getEvaluableStudents(): Promise<EvaluableStudent[]> {
  const { data } = await api.get<{ students: EvaluableStudent[] }>('/evaluations/students');
  return data.students;
}

export interface EvaluationInput {
  evaluation_period_start: string;
  evaluation_period_end: string;
  strengths: string;
  areas_for_improvement: string;
  recommendations: string;
  supervisor_remarks: string;
  responses: EvaluationResponseInput[];
}

/** Blank text = null, like the website's ConvertEmptyStringsToNull. */
function body(input: EvaluationInput) {
  const text = (value: string) => (value.trim() ? value.trim() : null);
  return {
    evaluation_period_start: input.evaluation_period_start,
    evaluation_period_end: input.evaluation_period_end,
    strengths: text(input.strengths),
    areas_for_improvement: text(input.areas_for_improvement),
    recommendations: text(input.recommendations),
    supervisor_remarks: text(input.supervisor_remarks),
    responses: input.responses,
  };
}

export async function createEvaluation(input: EvaluationInput & { student_id: number }): Promise<EvaluationWriteResponse> {
  const { data } = await api.post<EvaluationWriteResponse>('/evaluations', { student_id: input.student_id, ...body(input) });
  return data;
}

export async function updateEvaluation({ id, input }: { id: number; input: EvaluationInput }): Promise<EvaluationWriteResponse> {
  const { data } = await api.patch<EvaluationWriteResponse>(`/evaluations/${id}`, body(input));
  return data;
}

export type EvaluationAction = 'submit' | 'lock' | 'reopen';

export async function evaluationAction({ id, action }: { id: number; action: EvaluationAction }): Promise<EvaluationWriteResponse> {
  const { data } = await api.post<EvaluationWriteResponse>(`/evaluations/${id}/${action}`);
  return data;
}

export async function getManagedCriteria(): Promise<ManagedCriterion[]> {
  const { data } = await api.get<{ criteria: ManagedCriterion[] }>('/evaluation-criteria');
  return data.criteria;
}

export interface CriterionInput {
  category: string;
  label: string;
  description: string;
  /** Blank = server default. */
  sort_order: string;
}

function criterionBody(input: CriterionInput) {
  const description = input.description.trim();
  const sort = input.sort_order.trim();
  return {
    category: input.category.trim(),
    label: input.label.trim(),
    description: description ? description : null,
    // Sent as typed: a non-number gets the server's own integer message.
    sort_order: sort === '' ? null : /^\d+$/.test(sort) ? Number(sort) : sort,
  };
}

export async function createCriterion(input: CriterionInput): Promise<CriterionWriteResponse> {
  const { data } = await api.post<CriterionWriteResponse>('/evaluation-criteria', criterionBody(input));
  return data;
}

export async function updateCriterion({ id, input }: { id: number; input: CriterionInput }): Promise<CriterionWriteResponse> {
  const { data } = await api.patch<CriterionWriteResponse>(`/evaluation-criteria/${id}`, criterionBody(input));
  return data;
}

export async function setCriterionActive({ id, active }: { id: number; active: boolean }): Promise<CriterionWriteResponse> {
  const { data } = await api.post<CriterionWriteResponse>(`/evaluation-criteria/${id}/${active ? 'activate' : 'deactivate'}`);
  return data;
}

export async function deleteCriterion(id: number): Promise<CriterionWriteResponse> {
  const { data } = await api.delete<CriterionWriteResponse>(`/evaluation-criteria/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type ListData = InfiniteData<EvaluationsPage, string | null>;

export function useEvaluations(filters: EvaluationFilters) {
  return useInfiniteQuery({
    queryKey: evaluationKeys.list(filters),
    queryFn: ({ pageParam }) => getEvaluations(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

/** A row already loaded by a list, to show the detail header at once while it loads. */
export function evaluationFromLists(queryClient: QueryClient, id: number): EvaluationSummary | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: evaluationKeys.lists })) {
    const data = query.state.data as ListData | undefined;
    const row = data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
    if (row) return row;
  }
  return undefined;
}

export function useEvaluation(id: number | null) {
  return useQuery({
    queryKey: evaluationKeys.detail(id ?? 0),
    queryFn: () => getEvaluation(id as number),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

export function useEvaluationCriteria(enabled = true) {
  return useQuery({ queryKey: evaluationKeys.criteria, queryFn: getEvaluationCriteria, enabled, staleTime: 60_000 });
}

export function useEvaluableStudents(enabled = true) {
  return useQuery({ queryKey: evaluationKeys.students, queryFn: getEvaluableStudents, enabled, staleTime: 60_000 });
}

export function useManagedCriteria() {
  return useQuery({ queryKey: evaluationKeys.managedCriteria, queryFn: getManagedCriteria, staleTime: 30_000 });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Everything an evaluation write changes: the lists, Home's counts, the charts and the bell. */
export function refreshAfterEvaluationWrite(queryClient: QueryClient, id?: number) {
  void queryClient.invalidateQueries({ queryKey: evaluationKeys.lists });
  if (id !== undefined) void queryClient.invalidateQueries({ queryKey: evaluationKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

function applyFresh(queryClient: QueryClient, fresh: EvaluationDetail) {
  queryClient.setQueryData(evaluationKeys.detail(fresh.id), fresh);
}

/**
 * 422 code evaluation_rule ("Only draft evaluations can be edited.", ...): the evaluation changed
 * state meanwhile. The body carries the fresh evaluation.
 */
export function evaluationRuleRefusal(error: unknown): EvaluationDetail | null {
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation' || apiError.code !== 'evaluation_rule') return null;
  const fresh = apiError.body.evaluation;
  return fresh && typeof fresh === 'object' && 'id' in fresh ? (fresh as EvaluationDetail) : null;
}

function onWriteError(queryClient: QueryClient, error: unknown, id: number) {
  const fresh = evaluationRuleRefusal(error);
  if (fresh) applyFresh(queryClient, fresh);
  // Refused, reassigned, deleted or an unknown outcome (network): re-check what's true now.
  refreshAfterEvaluationWrite(queryClient, fresh ? undefined : id);
}

export function useCreateEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEvaluation,
    onSuccess: ({ evaluation }) => {
      applyFresh(queryClient, evaluation);
      refreshAfterEvaluationWrite(queryClient);
    },
  });
}

export function useUpdateEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateEvaluation,
    onSuccess: ({ evaluation }) => {
      applyFresh(queryClient, evaluation);
      refreshAfterEvaluationWrite(queryClient);
    },
    onError: (error, { id }) => onWriteError(queryClient, error, id),
  });
}

export function useEvaluationAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: evaluationAction,
    onSuccess: ({ evaluation }) => {
      applyFresh(queryClient, evaluation);
      refreshAfterEvaluationWrite(queryClient);
    },
    onError: (error, { id }) => onWriteError(queryClient, error, id),
  });
}

/** Criteria changes alter the form (active criteria) and the management list. */
function refreshAfterCriteriaWrite(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: evaluationKeys.managedCriteria });
  void queryClient.invalidateQueries({ queryKey: evaluationKeys.criteria });
  void queryClient.invalidateQueries({ queryKey: ['analytics'] });
}

export function useCreateCriterion() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createCriterion, onSettled: () => refreshAfterCriteriaWrite(queryClient) });
}

export function useUpdateCriterion() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: updateCriterion, onSettled: () => refreshAfterCriteriaWrite(queryClient) });
}

export function useSetCriterionActive() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: setCriterionActive, onSettled: () => refreshAfterCriteriaWrite(queryClient) });
}

export function useDeleteCriterion() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: deleteCriterion, onSettled: () => refreshAfterCriteriaWrite(queryClient) });
}
