import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ROLE_STUDENT, ROLE_SUPERVISOR } from '@/api/types';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { SplashView } from '@/components/SplashView';
import { config } from '@/config';
import { queryClient } from '@/lib/query-client';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 250 });

export default function RootLayout() {
  // The native splash hands over to <SplashView>, which looks the same, as soon as JS is running.
  useEffect(() => {
    SplashScreen.hide();
  }, []);

  if (config.configError) {
    return (
      <SafeAreaProvider>
        <SplashView error={`App is not configured: ${config.configError}`} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { status, user, restoreError, retryRestore, signOut } = useAuth();

  if (status === 'restoring') {
    return <SplashView />;
  }
  if (status === 'restoreFailed') {
    return (
      <SplashView
        error={restoreError?.message ?? "Can't reach the server."}
        onRetry={() => void retryRestore()}
        onSignOut={() => void signOut()}
      />
    );
  }

  const signedIn = status === 'signedIn';
  const role = user?.role_id;

  // Which screens exist is decided by the session; index.tsx redirects to the right one.
  // This is navigation only: the API enforces every role rule on its side.
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === ROLE_STUDENT}>
        <Stack.Screen name="student" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && role === ROLE_SUPERVISOR}>
        <Stack.Screen name="supervisor" />
      </Stack.Protected>
    </Stack>
  );
}
