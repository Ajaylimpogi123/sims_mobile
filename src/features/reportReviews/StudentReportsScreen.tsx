import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';

import { ReportReviewsList } from './ReportReviewsList';

/**
 * Route entry: /student-reports/12?name=Juan%20Dela%20Cruz — one student's reports (Report Reviews
 * filtered by students.id), opened from the student's Attendance Log. Same scope as the list:
 * a Supervisor only ever gets their own students' reports from the API.
 */
export function StudentReportsScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const studentId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const name = typeof params.name === 'string' && params.name.trim() ? params.name.trim() : null;

  if (studentId === null) {
    return (
      <View className="flex-1 bg-gray-50 p-4">
        <EmptyState icon="person-outline" message="We couldn't find that student. They may have been removed or reassigned." />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Reports' }} />
      <ReportReviewsList
        studentId={studentId}
        top={
          name ? (
            <Text accessibilityRole="header" className="text-base font-semibold text-gray-900" numberOfLines={2}>
              {name}
            </Text>
          ) : undefined
        }
      />
    </>
  );
}
