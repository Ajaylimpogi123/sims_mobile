import '@/global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MESSAGES } from '@/api/errors';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { SplashView } from '@/components/SplashView';
import { config } from '@/config';
import { canUse } from '@/navigation/access';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme/colors';

void SplashScreen.preventAutoHideAsync();
// Expo Go can't customize the splash screen (it logs a warning); real builds fade it out.
if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
  SplashScreen.setOptions({ fade: true, duration: 250 });
}

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
  const { status, me, navigation, restoreError, retryRestore, signOut } = useAuth();

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
      {/* Every role: opened from the header bell (and staff's More), above the role's tabs. */}
      <Stack.Protected guard={signedIn && !!group}>
        <Stack.Screen
          name="notifications"
          options={{
            headerShown: true,
            title: 'Notifications',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Students (access.ts "attendance"): Time In / Time Out / Emergency capture, above the tabs. */}
      <Stack.Protected guard={signedIn && group === 'student' && !!me && canUse('attendance', me)}>
        <Stack.Screen
          name="attendance-capture"
          options={{
            headerShown: true,
            title: 'My Attendance',
            animation: 'slide_from_bottom',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Students (access.ts "my-reports"): a report and the New / Edit Report form, above the tabs. */}
      <Stack.Protected guard={signedIn && group === 'student' && !!me && canUse('my-reports', me)}>
        <Stack.Screen
          name="report/[id]"
          options={{
            headerShown: true,
            title: 'Report',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="report-form"
          options={{
            headerShown: true,
            title: 'New Report',
            animation: 'slide_from_bottom',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Students (access.ts "feedback"): one evaluation from My Feedback, above the tabs. */}
      <Stack.Protected guard={signedIn && group === 'student' && !!me && canUse('feedback', me)}>
        <Stack.Screen
          name="feedback/[id]"
          options={{
            headerShown: true,
            title: 'Evaluation',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Supervisors and Admins (access.ts "approvals"; never Coordinators): one record's evidence, above the tabs. */}
      <Stack.Protected guard={signedIn && !!group && !!me && canUse('approvals', me)}>
        <Stack.Screen
          name="approval/[id]"
          options={{
            headerShown: true,
            title: 'Attendance Evidence',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Supervisors, Coordinators (view only), Admins (access.ts "attendance-monitoring"): a student's Attendance Log
          and the Add / Edit Entry form, above the tabs. Write buttons follow the API's per-student flags. */}
      <Stack.Protected guard={signedIn && !!group && !!me && canUse('attendance-monitoring', me)}>
        <Stack.Screen
          name="monitoring/[id]"
          options={{
            headerShown: true,
            title: 'Attendance Log',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="monitoring-entry"
          options={{
            headerShown: true,
            title: 'Add Entry',
            animation: 'slide_from_bottom',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Supervisors (view only), Coordinators, Admins (access.ts "report-reviews"): one report with the Review form
          when the API says can_review, and one student's reports, above the tabs. */}
      <Stack.Protected guard={signedIn && !!group && !!me && canUse('report-reviews', me)}>
        <Stack.Screen
          name="report-review/[id]"
          options={{
            headerShown: true,
            title: 'Report',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="student-reports/[id]"
          options={{
            headerShown: true,
            title: 'Reports',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Supervisors, Coordinators (view only), Admins (access.ts "evaluations"): one evaluation and the New / Edit
          Evaluation form, above the tabs. Buttons follow the API's can_create / can_edit / can_submit / can_lock / can_reopen. */}
      <Stack.Protected guard={signedIn && !!group && !!me && canUse('evaluations', me)}>
        <Stack.Screen
          name="evaluation/[id]"
          options={{
            headerShown: true,
            title: 'Evaluation Detail',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
        <Stack.Screen
          name="evaluation-form"
          options={{
            headerShown: true,
            title: 'New Evaluation',
            animation: 'slide_from_bottom',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
      {/* Supervisors, Coordinators, Admins (access.ts): opened from Home, above the role's tabs. */}
      <Stack.Protected guard={signedIn && !!group && !!me && canUse('analytics', me)}>
        <Stack.Screen
          name="analytics"
          options={{
            headerShown: true,
            title: 'Analytics',
            animation: 'slide_from_right',
            headerStyle: { backgroundColor: colors.brand700 },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '600' },
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}
