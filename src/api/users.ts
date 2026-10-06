import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import type { ManagedUser, UserFilters, UserRolesResponse, UsersPage, UserWriteResponse } from './types';

const PER_PAGE = 20;

/** Server limits (same rules as the website's user forms). */
export const USER_NAME_MAX = 255;
export const USER_EMAIL_MAX = 255;
export const USER_SEARCH_MAX = 255;

export const userKeys = {
  all: ['users'] as const,
  lists: ['users', 'list'] as const,
  list: (filters: UserFilters) => ['users', 'list', filters] as const,
  detail: (id: number) => ['users', 'detail', id] as const,
  roles: ['users', 'roles'] as const,
};

export const NO_USER_FILTERS: UserFilters = { search: '', roleId: null, status: null };

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getUsers(filters: UserFilters, page: number): Promise<UsersPage> {
  const search = filters.search.trim();
  const { data } = await api.get<UsersPage>('/users', {
    params: {
      per_page: PER_PAGE,
      page,
      ...(search ? { search } : {}),
      ...(filters.roleId !== null ? { role_id: filters.roleId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
  });
  return data;
}

export async function getUser(id: number): Promise<ManagedUser> {
  const { data } = await api.get<{ data: ManagedUser }>(`/users/${id}`);
  return data.data;
}

export async function getUserRoles(): Promise<UserRolesResponse> {
  const { data } = await api.get<UserRolesResponse>('/users/roles');
  return data;
}

export interface UserInput {
  name: string;
  email: string;
  role_id: number | null;
  password: string;
  password_confirmation: string;
}

function body(input: UserInput) {
  return {
    name: input.name.trim(),
    email: input.email.trim(),
    role_id: input.role_id,
    password: input.password,
    password_confirmation: input.password_confirmation,
  };
}

export async function createUser(input: UserInput): Promise<UserWriteResponse> {
  const { data } = await api.post<UserWriteResponse>('/users', body(input));
  return data;
}

/** A blank password keeps the current one (website: "Leave blank to keep the current password"). */
export async function updateUser({ id, input }: { id: number; input: UserInput }): Promise<UserWriteResponse> {
  const { password, password_confirmation, ...rest } = body(input);
  const { data } = await api.patch<UserWriteResponse>(`/users/${id}`, password ? { ...rest, password, password_confirmation } : rest);
  return data;
}

/** Separate, idempotent endpoints: safe to retry. */
export async function setUserActive({ id, active }: { id: number; active: boolean }): Promise<UserWriteResponse> {
  const { data } = await api.post<UserWriteResponse>(`/users/${id}/${active ? 'activate' : 'deactivate'}`);
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type ListData = InfiniteData<UsersPage, number>;

export function useUsers(filters: UserFilters) {
  return useInfiniteQuery({
    queryKey: userKeys.list(filters),
    queryFn: ({ pageParam }) => getUsers(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.current_page + 1 : undefined),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });
}

/** A row already loaded by a list, to show the detail at once while it loads. */
export function userFromLists(queryClient: QueryClient, id: number): ManagedUser | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: userKeys.lists })) {
    const data = query.state.data as ListData | undefined;
    const row = data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
    if (row) return row;
  }
  return undefined;
}

export function useUser(id: number | null) {
  return useQuery({
    queryKey: userKeys.detail(id ?? 0),
    queryFn: () => getUser(id as number),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

/** Create-form roles when the list hasn't loaded them (e.g. form opened before the list). */
export function useUserRoles(enabled = true) {
  return useQuery({ queryKey: userKeys.roles, queryFn: getUserRoles, enabled, staleTime: 5 * 60_000 });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Everything a user write changes: the lists, the detail, Home's counts and Internship Assignment rows (name, email, status). */
export function refreshAfterUserWrite(queryClient: QueryClient, id?: number) {
  void queryClient.invalidateQueries({ queryKey: userKeys.lists });
  if (id !== undefined) void queryClient.invalidateQueries({ queryKey: userKeys.detail(id) });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  // assignmentKeys.all (src/api/assignments.ts), by value: that file imports this one.
  void queryClient.invalidateQueries({ queryKey: ['assignments'] });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: ({ user }) => queryClient.setQueryData(userKeys.detail(user.id), user),
    onSettled: () => refreshAfterUserWrite(queryClient),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUser,
    onSuccess: ({ user }) => queryClient.setQueryData(userKeys.detail(user.id), user),
    onSettled: (_data, _error, { id }) => refreshAfterUserWrite(queryClient, id),
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setUserActive,
    onSuccess: ({ user }) => queryClient.setQueryData(userKeys.detail(user.id), user),
    onSettled: (_data, _error, { id }) => refreshAfterUserWrite(queryClient, id),
  });
}
