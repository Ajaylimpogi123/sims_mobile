import { focusManager, MutationCache, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError, isTermArchived } from '@/api/errors';

const RETRYABLE: ApiError['kind'][] = ['network', 'timeout', 'server'];

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      // 422 term_archived: the record belongs to a past term (only an Administrator may change it).
      // The screen shows the server's message; refetch everything so the per-row write flags (false
      // for archived records) hide the buttons that led here.
      if (isTermArchived(error)) void queryClient.invalidateQueries();
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Retry only transient failures; 4xx answers won't change by retrying.
      retry: (failureCount, error) =>
        failureCount < 2 && error instanceof ApiError && RETRYABLE.includes(error.kind),
    },
    mutations: {
      retry: false,
    },
  },
});

// React Native has no window focus: refetch stale queries when the app returns to the foreground.
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});
