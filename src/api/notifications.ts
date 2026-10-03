import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { api } from './client';
import type {
  AppNotification,
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationsPage,
  UnreadCountResponse,
} from './types';

const PER_PAGE = 20;
/** Light polling of the bell badge while the app is in the foreground (no push until Module 16). */
const UNREAD_POLL_MS = 60_000;

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getNotifications(cursor: string | null): Promise<NotificationsPage> {
  const { data } = await api.get<NotificationsPage>('/notifications', {
    params: { per_page: PER_PAGE, ...(cursor ? { cursor } : {}) },
  });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<UnreadCountResponse>('/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(id: number): Promise<MarkReadResponse> {
  const { data } = await api.post<MarkReadResponse>(`/notifications/${id}/read`);
  return data;
}

export async function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  const { data } = await api.post<MarkAllReadResponse>('/notifications/read-all');
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const unreadCountOptions = {
  queryKey: notificationKeys.unreadCount,
  queryFn: getUnreadCount,
  staleTime: 15_000,
} as const;

/** Unread count for the bell badge and the Notifications screen. Never polls by itself. */
export function useUnreadCount() {
  return useQuery(unreadCountOptions);
}

/**
 * THE one poller of the unread count. refetchInterval runs per observer, so mount this exactly
 * once per signed-in session (RoleTabs), never in each bell. Pauses in the background:
 * focusManager follows AppState (src/lib/query-client.ts).
 */
export function useUnreadCountPolling() {
  useQuery({ ...unreadCountOptions, refetchInterval: UNREAD_POLL_MS, refetchIntervalInBackground: false });
}

export function useNotificationsList() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Mutations (optimistic: the list and badge change at once, then sync with the server)
// ---------------------------------------------------------------------------

type ListData = InfiniteData<NotificationsPage, string | null>;

function updateListItems(queryClient: QueryClient, update: (item: AppNotification) => AppNotification) {
  queryClient.setQueryData<ListData>(notificationKeys.list, (old) =>
    old ? { ...old, pages: old.pages.map((page) => ({ ...page, data: page.data.map(update) })) } : old,
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Marks one notification read. Already-read items never call the API. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount });
      updateListItems(queryClient, (item) => (item.id === id && !item.read_at ? { ...item, read_at: nowIso() } : item));
      queryClient.setQueryData<number>(notificationKeys.unreadCount, (count) =>
        count === undefined ? count : Math.max(0, count - 1),
      );
    },
    onSuccess: (result) => {
      updateListItems(queryClient, (item) => (item.id === result.notification.id ? result.notification : item));
      queryClient.setQueryData<number>(notificationKeys.unreadCount, result.unread_count);
    },
    onError: () => {
      // Roll back to whatever the server says (404 = deleted / not ours, 429, offline...).
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount });
      const readAt = nowIso();
      updateListItems(queryClient, (item) => (item.read_at ? item : { ...item, read_at: readAt }));
      queryClient.setQueryData<number>(notificationKeys.unreadCount, 0);
    },
    onSuccess: (result) => {
      queryClient.setQueryData<number>(notificationKeys.unreadCount, result.unread_count);
    },
    onSettled: () => {
      // Fetch the server's read_at values (and anything that arrived meanwhile).
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
