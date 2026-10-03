import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from './client';
import { dashboardKeys } from './dashboard';
import { ApiError, toApiError } from './errors';
import { notificationKeys } from './notifications';
import type { AttendanceAction, AttendancePage, AttendanceSubmitResponse, AttendanceToday } from './types';

const PER_PAGE = 20;
/** Uploading a photo over mobile data takes longer than a normal request. */
const UPLOAD_TIMEOUT_MS = 60_000;

export const attendanceKeys = {
  all: ['attendance'] as const,
  today: ['attendance', 'today'] as const,
  history: ['attendance', 'history'] as const,
};

const SUBMIT_PATHS: Record<AttendanceAction, string> = {
  time_in: '/attendance/time-in',
  time_out: '/attendance/time-out',
  emergency_time_out: '/attendance/emergency-time-out',
};

/** What the capture flow collected; sent as multipart/form-data. */
export interface AttendanceCapture {
  action: AttendanceAction;
  /** file:// URI of the resized JPEG */
  photoUri: string;
  latitude: number;
  longitude: number;
  /** metres, or null when the phone didn't report it */
  accuracy: number | null;
  /** Android's fake-GPS flag; null when the OS doesn't report it (then it isn't sent) */
  mocked: boolean | null;
  /** Emergency time-out only */
  note?: string;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getAttendanceToday(): Promise<AttendanceToday> {
  const { data } = await api.get<AttendanceToday>('/attendance/today');
  return data;
}

export async function getAttendanceHistory(cursor: string | null): Promise<AttendancePage> {
  const { data } = await api.get<AttendancePage>('/attendance', {
    params: { per_page: PER_PAGE, ...(cursor ? { cursor } : {}) },
  });
  return data;
}

export async function submitAttendance(capture: AttendanceCapture): Promise<AttendanceSubmitResponse> {
  const form = new FormData();
  // React Native's FormData takes a { uri, name, type } file descriptor.
  form.append('photo', { uri: capture.photoUri, name: 'attendance.jpg', type: 'image/jpeg' } as unknown as Blob);
  form.append('latitude', capture.latitude.toFixed(7));
  form.append('longitude', capture.longitude.toFixed(7));
  if (capture.accuracy !== null && Number.isFinite(capture.accuracy)) {
    form.append('accuracy', Math.max(0, capture.accuracy).toFixed(2));
  }
  if (capture.mocked !== null) form.append('mocked', capture.mocked ? '1' : '0');
  if (capture.action === 'emergency_time_out') form.append('note', capture.note ?? '');

  // No Content-Type: axios lets React Native set multipart/form-data with its boundary.
  const { data } = await api.post<AttendanceSubmitResponse>(SUBMIT_PATHS[capture.action], form, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useAttendanceToday() {
  return useQuery({ queryKey: attendanceKeys.today, queryFn: getAttendanceToday, staleTime: 15_000 });
}

export function useAttendanceHistory() {
  return useInfiniteQuery({
    queryKey: attendanceKeys.history,
    queryFn: ({ pageParam }) => getAttendanceHistory(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

/** 409 code no_student_profile: a Student account with no Student row. */
export function isNoStudentProfile(error: unknown): boolean {
  const apiError = toApiError(error);
  return apiError.kind === 'conflict' && apiError.code === 'no_student_profile';
}

/** 422 code attendance_rule (e.g. "You already have a time-in request for today.") carries the fresh today state. */
export function ruleRefusalToday(error: unknown): AttendanceToday | null {
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation' || apiError.code !== 'attendance_rule') return null;
  const today = apiError.body.today;
  return today && typeof today === 'object' && 'actions' in today ? (today as AttendanceToday) : null;
}

/** Everything a submitted leg changes: today, history, the Home dashboard and the bell. */
function refreshAfterSubmit(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: attendanceKeys.history });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
}

export function useSubmitAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAttendance,
    onSuccess: (response) => {
      const { message: _message, ...today } = response;
      queryClient.setQueryData<AttendanceToday>(attendanceKeys.today, today);
      refreshAfterSubmit(queryClient);
    },
    onError: (error) => {
      const today = ruleRefusalToday(error);
      if (today) {
        // The server refused on a state rule: show what it says is true now.
        queryClient.setQueryData<AttendanceToday>(attendanceKeys.today, today);
        refreshAfterSubmit(queryClient);
      } else if (error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout')) {
        // The upload may have reached the server before the connection dropped: re-check today.
        void queryClient.invalidateQueries({ queryKey: attendanceKeys.today });
      }
    },
  });
}
