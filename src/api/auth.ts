import { queryOptions, useQuery } from '@tanstack/react-query';

import { config } from '@/config';

import { api } from './client';
import type { LoginRequest, LoginResponse, MeResponse } from './types';

/** POST /login: exchanges credentials for a Sanctum token. */
export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/login', body);
  return data;
}

/** POST /logout: revokes this device's token (204). */
export async function logout(): Promise<void> {
  await api.post('/logout', undefined, { skipSessionEnd: true, timeout: config.logoutTimeoutMs });
}

/** GET /me: the signed-in user plus the role-specific summary. */
export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/me');
  return data;
}

export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: getMe,
  staleTime: 5 * 60_000,
});

export function useMe() {
  return useQuery(meQueryOptions);
}
