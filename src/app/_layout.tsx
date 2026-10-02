import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MESSAGES } from '@/api/errors';
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
  const { status, navigation, restoreError, retryRestore, signOut } = useAuth();

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
  if (signedIn && !navigation) {
    // /me came back with a role this app version doesn't know.
    return <SplashView error={MESSAGES.roleNotAllowed} onSignOut={() => void signOut()} />;
  }
  const group = signedIn ? navigation?.group : null;

  // Which route group exists is decided by src/navigation/access.ts; index.tsx redirects into it.
  // This is navigation only: the API enforces every role rule on its side.
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={group === 'student'}>
        <Stack.Screen name="student" />
      </Stack.Protected>
      <Stack.Protected guard={group === 'supervisor'}>
        <Stack.Screen name="supervisor" />
      </Stack.Protected>
      <Stack.Protected guard={group === 'staff'}>
        <Stack.Screen name="staff" />
      </Stack.Protected>
    </Stack>
  );
}
