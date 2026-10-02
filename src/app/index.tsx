import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/AuthProvider';

/** Entry route: sends the user to Login or to their role's home tab (see src/navigation/access.ts). */
export default function Index() {
  const { status, navigation } = useAuth();

  if (status === 'signedIn' && navigation) return <Redirect href={navigation.home} />;
  return <Redirect href="/login" />;
}
