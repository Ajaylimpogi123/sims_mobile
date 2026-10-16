import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import { monitoringKeys } from './monitoring';
import type { CompaniesPage, CompanyFilters, CompanyWriteResponse, ManagedCompany, SupervisorOption } from './types';

const PER_PAGE = 20;

/** Server limits (same rules as the website's company forms). */
export const COMPANY_TEXT_MAX = 255;
export const COMPANY_CONTACT_NUMBER_MAX = 50;
/** Website Add Company form: digits only, 11 at most (e.g. 09171234567). */
export const COMPANY_NEW_CONTACT_DIGITS = 11;
export const COMPANY_SEARCH_MAX = 255;

export const companyKeys = {
  all: ['companies'] as const,
  lists: ['companies', 'list'] as const,
  list: (filters: CompanyFilters) => ['companies', 'list', filters] as const,
  detail: (id: number) => ['companies', 'detail', id] as const,
  supervisorOptions: ['companies', 'supervisor-options'] as const,
};

export const NO_COMPANY_FILTERS: CompanyFilters = { search: '', status: null };

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getCompanies(filters: CompanyFilters, page: number): Promise<CompaniesPage> {
  const search = filters.search.trim();
  const { data } = await api.get<CompaniesPage>('/companies', {
    params: {
      per_page: PER_PAGE,
      page,
      ...(search ? { search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
  });
  return data;
}

export async function getCompany(id: number): Promise<ManagedCompany> {
  const { data } = await api.get<{ data: ManagedCompany }>(`/companies/${id}`);
  return data.data;
}

/** Active Supervisor accounts for the Company Supervisor picker. */
export async function getSupervisorOptions(): Promise<SupervisorOption[]> {
  const { data } = await api.get<{ data: SupervisorOption[] }>('/companies/supervisor-options');
  return data.data;
}

/** Form values as typed; `slots` stays text until it is sent. */
export interface CompanyInput {
  company_name: string;
  address: string;
  /** The Company Supervisor; null = none. Its students' supervisor follows it. */
  supervisor_id: number | null;
  contact_number: string;
  email: string;
  industry: string;
  slots: string;
}

/** Blank optional fields go as null, like the website's nullable rules; slots as a whole number when it is one. */
function body(input: CompanyInput) {
  const text = (value: string) => {
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };
  const slots = input.slots.trim();
  return {
    company_name: input.company_name.trim(),
    address: text(input.address),
    supervisor_id: input.supervisor_id,
    contact_number: text(input.contact_number),
    email: text(input.email),
    industry: text(input.industry),
    // Let the server word the error for anything that isn't a whole number.
    slots: /^\d+$/.test(slots) ? Number(slots) : slots,
  };
}

export async function createCompany(input: CompanyInput): Promise<CompanyWriteResponse> {
  const { data } = await api.post<CompanyWriteResponse>('/companies', body(input));
  return data;
}

export async function updateCompany({ id, input }: { id: number; input: CompanyInput }): Promise<CompanyWriteResponse> {
  const { data } = await api.patch<CompanyWriteResponse>(`/companies/${id}`, body(input));
  return data;
}

/** Separate, idempotent endpoints: safe to retry. */
export async function setCompanyActive({ id, active }: { id: number; active: boolean }): Promise<CompanyWriteResponse> {
  const { data } = await api.post<CompanyWriteResponse>(`/companies/${id}/${active ? 'activate' : 'deactivate'}`);
  return data;
}

export async function deleteCompany(id: number): Promise<{ message: string }> {
  const { data } = await api.delete<{ message: string }>(`/companies/${id}`);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type ListData = InfiniteData<CompaniesPage, number>;

export function useCompanies(filters: CompanyFilters) {
  return useInfiniteQuery({
    queryKey: companyKeys.list(filters),
    queryFn: ({ pageParam }) => getCompanies(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.current_page + 1 : undefined),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

/** A row already loaded by a list, to show the detail at once while it loads. */
export function companyFromLists(queryClient: QueryClient, id: number): ManagedCompany | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: companyKeys.lists })) {
    const data = query.state.data as ListData | undefined;
    const row = data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
    if (row) return row;
  }
  return undefined;
}

export function useCompany(id: number | null) {
  return useQuery({
    queryKey: companyKeys.detail(id ?? 0),
    queryFn: () => getCompany(id as number),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

/** Active Supervisor accounts for the Company Supervisor picker (re-checked when the form opens). */
export function useSupervisorOptions() {
  return useQuery({ queryKey: companyKeys.supervisorOptions, queryFn: getSupervisorOptions, staleTime: 0 });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Everything a company write changes: the lists, the detail, Home's counts, the Analytics filter
 * options, monitoring screens (company names, students' supervisors), and Internship Assignment's
 * lists and company options (slot counts; a supervisor change moves the company's students).
 */
export function refreshAfterCompanyWrite(queryClient: QueryClient, id?: number) {
  void queryClient.invalidateQueries({ queryKey: companyKeys.lists });
  if (id !== undefined) void queryClient.invalidateQueries({ queryKey: companyKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.filterOptions });
  void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
  // assignmentKeys.all (src/api/assignments.ts), by value: that file imports this one.
  void queryClient.invalidateQueries({ queryKey: ['assignments'] });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCompany,
    onSuccess: ({ company }) => queryClient.setQueryData(companyKeys.detail(company.id), company),
    onSettled: () => refreshAfterCompanyWrite(queryClient),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateCompany,
    onSuccess: ({ company }) => queryClient.setQueryData(companyKeys.detail(company.id), company),
    onSettled: (_data, _error, { id }) => refreshAfterCompanyWrite(queryClient, id),
  });
}

export function useSetCompanyActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setCompanyActive,
    onSuccess: ({ company }) => queryClient.setQueryData(companyKeys.detail(company.id), company),
    onSettled: (_data, _error, { id }) => refreshAfterCompanyWrite(queryClient, id),
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCompany,
    onSuccess: (_data, id) => queryClient.removeQueries({ queryKey: companyKeys.detail(id), exact: true }),
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({ queryKey: companyKeys.lists });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.filterOptions });
      void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });
}

