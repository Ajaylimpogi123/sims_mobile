import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from '@/api/errors';

const RETRYABLE: ApiError['kind'][] = ['network', 'timeout', 'server'];

export const queryClient = new QueryClient({
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
