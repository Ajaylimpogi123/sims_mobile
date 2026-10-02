import { Redirect } from 'expo-router';

import { ROLE_STUDENT, ROLE_SUPERVISOR } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';

/** Entry route: sends the user to Login or to their role's tabs. */
export default function Index() {
  const { status, user } = useAuth();

  if (status === 'signedIn' && user?.role_id === ROLE_STUDENT) return <Redirect href="/student" />;
  if (status === 'signedIn' && user?.role_id === ROLE_SUPERVISOR) return <Redirect href="/supervisor" />;
  return <Redirect href="/login" />;
}
