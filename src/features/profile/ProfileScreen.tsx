import Constants from 'expo-constants';
import { useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useMe } from '@/api/auth';
import { toApiError } from '@/api/errors';
import type { InternshipStatus, MeResponse, StudentProfile } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors } from '@/theme/colors';

const STATUS_LABEL: Record<InternshipStatus, string> = {
  not_started: 'Not started',
  ongoing: 'Ongoing',
  completed: 'Completed',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

function Row({ label, value, muted = false, last = false }: { label: string; value: string; muted?: boolean; last?: boolean }) {
  return (
    <View className={`flex-row justify-between gap-4 py-3 ${last ? '' : 'border-b border-slate-100'}`}>
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className={`flex-1 text-right text-sm font-medium ${muted ? 'text-slate-400' : 'text-slate-900'}`}>{value}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{children}</Text>;
}

function StudentDetails({ student }: { student: StudentProfile | null }) {
  if (!student) {
    return <Banner tone="warning" message="Your student profile isn't set up yet. Please contact your internship coordinator." />;
  }
  return (
    <>
      <Card>
        <SectionTitle>Internship</SectionTitle>
        <Row label="Company" value={student.company?.name ?? 'Not assigned yet'} muted={!student.company} />
        <Row label="Supervisor" value={student.supervisor?.name ?? 'Not assigned yet'} muted={!student.supervisor} />
        <Row label="Status" value={STATUS_LABEL[student.internship_status] ?? student.internship_status} />
        <Row
          label="Required hours"
          value={student.required_hours !== null ? `${student.required_hours} hours` : 'Not set yet'}
          muted={student.required_hours === null}
          last
        />
      </Card>
      <Card>
        <SectionTitle>Student</SectionTitle>
        <Row label="Student number" value={student.student_number} />
        <Row label="Course" value={student.course} />
        <Row label="Section" value={student.section} last />
      </Card>
    </>
  );
}

function SupervisorDetails({ me }: { me: MeResponse }) {
  const count = me.supervisor?.students_count ?? 0;
  return (
    <Card>
      <SectionTitle>Supervision</SectionTitle>
      <Row label="Assigned students" value={String(count)} last />
    </Card>
  );
}

/** Profile tab, shared by the Student and Supervisor layouts. */
export function ProfileScreen() {
  const { signOut } = useAuth();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = () => {
    Alert.alert('Log out', 'Log out of SIMS on this phone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          // No setSigningOut(false): this screen unmounts once signed out.
        },
      },
    ]);
  };

  const data = me.data;

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-4 p-4 pb-10"
      refreshControl={
        <RefreshControl refreshing={me.isRefetching} onRefresh={() => void me.refetch()} colors={[colors.brand700]} />
      }>
      {me.isPending ? (
        <View className="items-center py-16">
          <ActivityIndicator size="large" color={colors.brand700} accessibilityLabel="Loading profile" />
        </View>
      ) : me.isError && !data ? (
        <View className="gap-3">
          <Banner message={toApiError(me.error).message} />
          <Button label="Try again" variant="outline" onPress={() => void me.refetch()} />
        </View>
      ) : data ? (
        <>
          {me.isError ? <Banner tone="warning" message={`Showing saved details. ${toApiError(me.error).message}`} /> : null}

          <Card className="items-center gap-2 py-6">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-700">
              <Text className="text-2xl font-bold text-white">{initials(data.user.name)}</Text>
            </View>
            <Text className="mt-2 text-center text-xl font-bold text-slate-900">{data.user.name}</Text>
            <Text className="text-center text-sm text-slate-500">{data.user.email}</Text>
            <View className="mt-1 rounded-full bg-brand-100 px-3 py-1">
              <Text className="text-xs font-semibold text-brand-800">{data.user.role}</Text>
            </View>
          </Card>

          {data.user.role_id === 1 ? <StudentDetails student={data.student} /> : <SupervisorDetails me={data} />}
        </>
      ) : null}

      <Button label="Log out" variant="danger" onPress={confirmSignOut} loading={signingOut} loadingLabel="Logging out…" />

      <Text className="text-center text-xs text-slate-400">
        SIMS v{Constants.expoConfig?.version ?? '1.0.0'} · Bacolod City College
      </Text>
    </ScrollView>
  );
}
