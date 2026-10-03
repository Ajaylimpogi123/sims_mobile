import { useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import type { FeedbackDetail, FeedbackPage, FeedbackSummary } from './types';

const PER_PAGE = 20;

export const feedbackKeys = {
  all: ['feedback'] as const,
  list: ['feedback', 'list'] as const,
  detail: (id: number) => ['feedback', 'detail', id] as const,
};

export async function getFeedbackPage(cursor: string | null, perPage = PER_PAGE): Promise<FeedbackPage> {
  const { data } = await api.get<FeedbackPage>('/feedback', {
    params: { per_page: perPage, ...(cursor ? { cursor } : {}) },
  });
  return data;
}

export async function getFeedback(id: number): Promise<FeedbackDetail> {
  const { data } = await api.get<{ evaluation: FeedbackDetail }>(`/feedback/${id}`);
  return data.evaluation;
}

export function useFeedbackList() {
  return useInfiniteQuery({
    queryKey: feedbackKeys.list,
    queryFn: ({ pageParam }) => getFeedbackPage(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    staleTime: 60_000,
  });
}

/** The list row for this evaluation, to show the header at once while the detail loads. */
export function feedbackFromList(queryClient: QueryClient, id: number): FeedbackSummary | undefined {
  const data = queryClient.getQueryData<InfiniteData<FeedbackPage>>(feedbackKeys.list);
  return data?.pages.flatMap((page) => page.data).find((item) => item.id === id);
}

export function useFeedback(id: number | null) {
  return useQuery({
    queryKey: feedbackKeys.detail(id ?? 0),
    queryFn: () => getFeedback(id as number),
    enabled: id !== null,
    staleTime: 60_000,
  });
}

