import { Stack } from 'expo-router';

import { useNavigationAccess } from '@/auth/AuthProvider';
import type { FeatureKey } from '@/navigation/access';
import { colors } from '@/theme/colors';

/** Every screen the More list can open (file name = feature key). */
const MORE_ROUTES: FeatureKey[] = [
  'users',
  'report-reviews',
  'students',
  'companies',
  'approvals',
  'evaluations',
  'criteria',
  'attendance-monitoring',
  'progress',
  'notifications',
  'profile',
];

/**
 * Stack inside the More tab, so the tab bar stays visible. Each screen is mounted only if
 * src/navigation/access.ts lists it in this user's More items (role + /me staff flags).
 */
export default function MoreLayout() {
  const navigation = useNavigationAccess();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand700 },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      {MORE_ROUTES.map((key) => {
        const item = navigation.more.find((m) => m.key === key);
        return (
          <Stack.Protected key={key} guard={!!item}>
            <Stack.Screen name={key} options={{ title: item?.title }} />
          </Stack.Protected>
        );
      })}
    </Stack>
  );
}
