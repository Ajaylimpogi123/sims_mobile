import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { Semester, Term, TermsResponse, TermWriteResponse } from './types';

export const termKeys = {
  all: ['terms'] as const,
};

/** Server rule: school_year_start integer 2000–2100. */
export const SCHOOL_YEAR_MIN = 2000;
export const SCHOOL_YEAR_MAX = 2100;

/** In the website's order. */
export const SEMESTERS: { value: Semester; label: string }[] = [
  { value: 'first', label: '1st Semester' },
  { value: 'second', label: '2nd Semester' },
  { value: 'summer', label: 'Summer' },
];

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getTerms(): Promise<TermsResponse> {
  const { data } = await api.get<TermsResponse>('/terms');
  return data;
}

/** As typed in the form; the server validates (422 on the same keys). */
export interface TermInput {
  school_year_start: string;
  semester: Semester;
  /** YYYY-MM-DD or '' (not set) */
  starts_on: string;
  ends_on: string;
}

function body(input: TermInput) {
  const year = input.school_year_start.trim();
  return {
    // Whole numbers as numbers; anything else as typed so the server's 422 explains it.
    school_year_start: /^\d+$/.test(year) ? Number(year) : year,
    semester: input.semester,
    starts_on: input.starts_on || null,
    ends_on: input.ends_on || null,
  };
}

export async function createTerm(input: TermInput): Promise<TermWriteResponse> {
  const { data } = await api.post<TermWriteResponse>('/terms', body(input));
  return data;
}

export async function updateTerm({ id, input }: { id: number; input: TermInput }): Promise<TermWriteResponse> {
  const { data } = await api.patch<TermWriteResponse>(`/terms/${id}`, body(input));
  return data;
}

export async function deleteTerm(id: number): Promise<TermWriteResponse> {
  const { data } = await api.delete<TermWriteResponse>(`/terms/${id}`);
  return data;
}

export async function setCurrentTerm(id: number): Promise<TermWriteResponse> {
  const { data } = await api.post<TermWriteResponse>(`/terms/${id}/current`);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Every term (all roles). Rarely changes. */
export function useTerms(enabled = true) {
  return useQuery({ queryKey: termKeys.all, queryFn: getTerms, enabled, staleTime: 5 * 60_000 });
}

/** A term already loaded by the list (the edit form opens from it). */
export function termFromList(queryClient: QueryClient, id: number): Term | undefined {
  return queryClient.getQueryData<TermsResponse>(termKeys.all)?.data.find((term) => term.id === id);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function refreshTerms(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: termKeys.all });
  // /me carries current_term.
  void queryClient.invalidateQueries({ queryKey: ['me'] });
}

export function useCreateTerm() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createTerm, onSettled: () => refreshTerms(queryClient) });
}

export function useUpdateTerm() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: updateTerm, onSettled: () => refreshTerms(queryClient) });
}

export function useDeleteTerm() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: deleteTerm, onSettled: () => refreshTerms(queryClient) });
}

/** Switching the current term changes what every list, count and chart shows: refetch everything. */
export function useSetCurrentTerm() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: setCurrentTerm, onSettled: () => void queryClient.invalidateQueries() });
}
