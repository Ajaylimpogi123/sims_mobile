import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { termKey, termParams, useTermParam, type TermKey } from '@/terms/selected-term';

import { approvalKeys } from './approvals';
import { api } from './client';
import { companyKeys } from './companies';
import { dashboardKeys } from './dashboard';
import { evaluationKeys } from './evaluations';
import { monitoringKeys } from './monitoring';
import { reviewKeys } from './reportReviews';
import type {
  AssignmentFilters,
  AssignmentOptions,
  AssignmentsPage,
  AssignmentStudent,
  AssignmentWriteResponse,
  InternshipStatus,
} from './types';
import { userKeys } from './users';

const PER_PAGE = 20;

/** Server limits (same rules as the website's student form). */
export const ASSIGNMENT_TEXT_MAX = 255;
export const ASSIGNMENT_STUDENT_NUMBER_MAX = 50;
export const ASSIGNMENT_SEARCH_MAX = 255;

/**
 * Root key ['assignments']. companies.ts and users.ts invalidate it by its literal value (their
 * writes change slot counts, company supervisors, names); they don't import this file to avoid a require cycle.
 */
export const assignmentKeys = {
  all: ['assignments'] as const,
  lists: ['assignments', 'list'] as const,
  list: (filters: AssignmentFilters, term: TermKey) => ['assignments', 'list', filters, term] as const,
  detail: (id: number) => ['assignments', 'detail', id] as const,
  options: ['assignments', 'options'] as const,
  /** Not under `lists`: assignmentFromLists() reads every `lists` entry as pages of rows. A prefix (per term below). */
  needsSupervisorCount: ['assignments', 'needs-supervisor-count'] as const,
  needsSupervisorCountFor: (term: TermKey) => ['assignments', 'needs-supervisor-count', term] as const,
};

export const NO_ASSIGNMENT_FILTERS: AssignmentFilters = {
  search: '',
  internship_status: null,
  status: null,
  company_id: null,
  needs_supervisor: false,
};

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** termId null = the current term. */
export async function getAssignments(filters: AssignmentFilters, page: number, termId: number | null = null): Promise<AssignmentsPage> {
  const search = filters.search.trim();
  const { data } = await api.get<AssignmentsPage>('/assignments', {
    params: {
      per_page: PER_PAGE,
      page,
      ...termParams(termId),
      ...(search ? { search } : {}),
      ...(filters.internship_status ? { internship_status: filters.internship_status } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.company_id !== null ? { company_id: filters.company_id } : {}),
      ...(filters.needs_supervisor ? { needs_supervisor: 1 } : {}),
    },
  });
  return data;
}

/** How many students the server flags needs_supervisor (all of them, ignoring the list's other filters). */
export async function getNeedsSupervisorCount(termId: number | null = null): Promise<number> {
  const { data } = await api.get<AssignmentsPage>('/assignments', { params: { per_page: 1, needs_supervisor: 1, ...termParams(termId) } });
  return data.meta.total;
}

export async function getAssignment(id: number): Promise<AssignmentStudent> {
  const { data } = await api.get<{ data: AssignmentStudent }>(`/assignments/${id}`);
  return data.data;
}

export async function getAssignmentOptions(): Promise<AssignmentOptions> {
  const { data } = await api.get<AssignmentOptions>('/assignments/options');
  return data;
}

/** The website's student form, in its order. Text stays as typed until it is sent. */
export interface AssignmentInput {
  name: string;
  email: string;
  student_number: string;
  course: string;
  section: string;
  /** The student's supervisor follows the company (its Company Supervisor); there's no per-student pick. */
  company_id: number | null;
  internship_status: InternshipStatus;
  internship_schedule: string;
  /**
   * As typed; '' (or 0) = not set. Undefined = not sent, which keeps the current value (used when an
   * older server doesn't send required_hours, so the form can't show it).
   */
  required_hours?: string;
  /** Move to another term (only while Not Started). Undefined = not sent (keeps the student's term). */
  term_id?: number;
}

/** Every field, every time, as the website form sends it; a blank schedule goes as null. */
function body(input: AssignmentInput) {
  const schedule = input.internship_schedule.trim();
  return {
    name: input.name.trim(),
    email: input.email.trim(),
    student_number: input.student_number.trim(),
    course: input.course.trim(),
    section: input.section.trim(),
    company_id: input.company_id,
    internship_status: input.internship_status,
    internship_schedule: schedule === '' ? null : schedule,
    ...(input.required_hours !== undefined ? { required_hours: requiredHoursValue(input.required_hours) } : {}),
    ...(input.term_id !== undefined ? { term_id: input.term_id } : {}),
  };
}

/** '' → null (not set); whole numbers as numbers; anything else as typed, so the server's 422 explains it. */
function requiredHoursValue(text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

export async function updateAssignment({ id, input }: { id: number; input: AssignmentInput }): Promise<AssignmentWriteResponse> {
  const { data } = await api.patch<AssignmentWriteResponse>(`/assignments/${id}`, body(input));
  return data;
}

/** Separate, idempotent endpoints: safe to retry. */
export async function setStudentActive({ id, active }: { id: number; active: boolean }): Promise<AssignmentWriteResponse> {
  const { data } = await api.post<AssignmentWriteResponse>(`/assignments/${id}/${active ? 'activate' : 'deactivate'}`);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type ListData = InfiniteData<AssignmentsPage, number>;

/** Students of the viewed term (src/terms/selected-term.ts). */
export function useAssignments(filters: AssignmentFilters) {
  const termId = useTermParam();
  return useInfiniteQuery({
    queryKey: assignmentKeys.list(filters, termKey(termId)),
    queryFn: ({ pageParam }) => getAssignments(filters, pageParam, termId),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.current_page + 1 : undefined),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

/** The "Needs supervisor (N)" chip's N. */
export function useNeedsSupervisorCount() {
  const termId = useTermParam();
  return useQuery({
    queryKey: assignmentKeys.needsSupervisorCountFor(termKey(termId)),
    queryFn: () => getNeedsSupervisorCount(termId),
    staleTime: 30_000,
  });
}

/** A row already loaded by a list, to show the detail at once while it loads. */
export function assignmentFromLists(queryClient: QueryClient, id: number): AssignmentStudent | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: assignmentKeys.lists })) {
    const data = query.state.data as ListData | undefined;
    const row = data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
    if (row) return row;
  }
  return undefined;
}

export function useAssignment(id: number | null) {
  return useQuery({
    queryKey: assignmentKeys.detail(id ?? 0),
    queryFn: () => getAssignment(id as number),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

/** Companies (slot counts + each Company Supervisor) for the form and the list's Company filter. Kept fresh: slots change often. */
export function useAssignmentOptions(enabled = true) {
  return useQuery({ queryKey: assignmentKeys.options, queryFn: getAssignmentOptions, enabled, staleTime: 10_000 });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Everything an assignment write changes: these lists and options (slot counts), Company
 * Management (students_count), User Management (name / email / status), Home's
 * counts and analytics filters, and the screens listing students with their company or
 * supervisor (monitoring, approvals, report reviews, evaluations).
 */
export function refreshAfterAssignmentWrite(queryClient: QueryClient, id?: number) {
  void queryClient.invalidateQueries({ queryKey: assignmentKeys.lists });
  void queryClient.invalidateQueries({ queryKey: assignmentKeys.options });
  void queryClient.invalidateQueries({ queryKey: assignmentKeys.needsSupervisorCount });
  if (id !== undefined) void queryClient.invalidateQueries({ queryKey: assignmentKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: companyKeys.all });
  void queryClient.invalidateQueries({ queryKey: userKeys.all });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.filterOptions });
  void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
  void queryClient.invalidateQueries({ queryKey: approvalKeys.all });
  void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
  void queryClient.invalidateQueries({ queryKey: evaluationKeys.all });
  // Moving a student to another term changes the Terms screen's student counts.
  void queryClient.invalidateQueries({ queryKey: ['terms'] });
}

export function useUpdateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAssignment,
    onSuccess: ({ student }) => queryClient.setQueryData(assignmentKeys.detail(student.id), student),
    onSettled: (_data, _error, { id }) => refreshAfterAssignmentWrite(queryClient, id),
  });
}

export function useSetStudentActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setStudentActive,
    onSuccess: ({ student }) => queryClient.setQueryData(assignmentKeys.detail(student.id), student),
    onSettled: (_data, _error, { id }) => refreshAfterAssignmentWrite(queryClient, id),
  });
}
