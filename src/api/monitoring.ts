import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { approvalKeys } from './approvals';
import { api } from './client';
import { dashboardKeys } from './dashboard';
import { toApiError } from './errors';
import type {
  AttendanceEntryResponse,
  MonitoredStudent,
  MonitoredStudentResponse,
  MonitoredStudentsPage,
  MonitoredStudentWriteResponse,
  MonitoringAttendancePage,
} from './types';

const PER_PAGE = 20;

/** Everything under ['monitoring'] is refreshed after any write (lists, progress, students, logs). */
export const monitoringKeys = {
  all: ['monitoring'] as const,
  students: (search: string) => ['monitoring', 'students', search] as const,
  progress: (search: string) => ['monitoring', 'progress', search] as const,
  student: (id: number) => ['monitoring', 'student', id] as const,
  log: (id: number) => ['monitoring', 'log', id] as const,
};

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

async function getStudents(path: '/monitoring/students' | '/progress', search: string, page: number): Promise<MonitoredStudentsPage> {
  const { data } = await api.get<MonitoredStudentsPage>(path, {
    params: { per_page: PER_PAGE, page, ...(search ? { search } : {}) },
  });
  return data;
}

export async function getMonitoredStudent(id: number): Promise<MonitoredStudent> {
  const { data } = await api.get<MonitoredStudentResponse>(`/monitoring/students/${id}`);
  return data.data;
}

export async function getAttendanceLog(studentId: number, cursor: string | null): Promise<MonitoringAttendancePage> {
  const { data } = await api.get<MonitoringAttendancePage>(`/monitoring/students/${studentId}/attendance`, {
    params: { per_page: PER_PAGE, ...(cursor ? { cursor } : {}) },
  });
  return data;
}

export interface EntryInput {
  /** YYYY-MM-DD */
  date: string;
  /** "HH:mm" or null (null clears that leg, and its photo + location, on an edit) */
  time_in: string | null;
  time_out: string | null;
}

export async function createEntry(studentId: number, entry: EntryInput): Promise<AttendanceEntryResponse> {
  const { data } = await api.post<AttendanceEntryResponse>(`/monitoring/students/${studentId}/attendance`, entry);
  return data;
}

export async function updateEntry(attendanceId: number, entry: EntryInput): Promise<AttendanceEntryResponse> {
  const { data } = await api.patch<AttendanceEntryResponse>(`/monitoring/attendance/${attendanceId}`, entry);
  return data;
}

export async function deleteEntry(attendanceId: number): Promise<MonitoredStudentWriteResponse> {
  const { data } = await api.delete<MonitoredStudentWriteResponse>(`/monitoring/attendance/${attendanceId}`);
  return data;
}

/** null / blank = "Not set" (the server stores 0 as not set too). */
export async function setRequiredHours(studentId: number, requiredHours: number | string | null): Promise<MonitoredStudentWriteResponse> {
  const { data } = await api.patch<MonitoredStudentWriteResponse>(`/monitoring/students/${studentId}/required-hours`, {
    required_hours: requiredHours,
  });
  return data;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

type StudentsData = InfiniteData<MonitoredStudentsPage, number>;

function useStudentPages(kind: 'students' | 'progress', search: string) {
  return useInfiniteQuery({
    queryKey: kind === 'students' ? monitoringKeys.students(search) : monitoringKeys.progress(search),
    queryFn: ({ pageParam }) => getStudents(kind === 'students' ? '/monitoring/students' : '/progress', search, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more ? last.meta.current_page + 1 : undefined),
    staleTime: 30_000,
  });
}

/** Attendance Monitoring list (search = student name contains, like the website's filter). */
export function useMonitoredStudents(search: string) {
  return useStudentPages('students', search);
}

/** Progress Monitoring list. */
export function useProgressStudents(search: string) {
  return useStudentPages('progress', search);
}

function findStudentInLists(queryClient: QueryClient, id: number): MonitoredStudent | undefined {
  const lists = [
    ...queryClient.getQueriesData<StudentsData>({ queryKey: ['monitoring', 'students'] }),
    ...queryClient.getQueriesData<StudentsData>({ queryKey: ['monitoring', 'progress'] }),
  ];
  for (const [, data] of lists) {
    for (const page of data?.pages ?? []) {
      const found = page.data.find((row) => row.id === id);
      if (found) return found;
    }
  }
  return undefined;
}

/** One student's header (shown at once from a list, then refreshed). */
export function useMonitoredStudent(id: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: monitoringKeys.student(id ?? 0),
    queryFn: () => getMonitoredStudent(id!),
    enabled: id !== null,
    staleTime: 15_000,
    placeholderData: () => (id !== null ? findStudentInLists(queryClient, id) : undefined),
  });
}

/** A student's attendance log, newest date first. */
export function useAttendanceLog(studentId: number | null) {
  return useInfiniteQuery({
    queryKey: monitoringKeys.log(studentId ?? 0),
    queryFn: ({ pageParam }) => getAttendanceLog(studentId!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.has_more && last.meta.next_cursor ? last.meta.next_cursor : undefined),
    enabled: studentId !== null,
    staleTime: 15_000,
  });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * After any write: the fresh student goes straight into the caches, then everything that shows
 * hours or attendance refetches (monitoring lists + logs, progress, dashboard, analytics, and
 * Pending Approvals, since an edit can approve a pending leg).
 */
export function refreshAfterMonitoringWrite(queryClient: QueryClient, fresh?: MonitoredStudent) {
  if (fresh) {
    queryClient.setQueryData(monitoringKeys.student(fresh.id), fresh);
  }
  void queryClient.invalidateQueries({ queryKey: monitoringKeys.all });
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.dashboard });
  void queryClient.invalidateQueries({ queryKey: ['analytics'] });
  void queryClient.invalidateQueries({ queryKey: approvalKeys.all });
}

/** Refetch what may have changed when a write failed in a way that says our data is stale. */
function refreshAfterFailure(queryClient: QueryClient, error: unknown) {
  const kind = toApiError(error).kind;
  if (kind === 'not_found' || kind === 'network' || kind === 'timeout') refreshAfterMonitoringWrite(queryClient);
}

export function useCreateEntry(studentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entry: EntryInput) => createEntry(studentId, entry),
    onSuccess: (response) => refreshAfterMonitoringWrite(queryClient, response.student),
    onError: (error) => refreshAfterFailure(queryClient, error),
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, entry }: { id: number; entry: EntryInput }) => updateEntry(id, entry),
    onSuccess: (response) => refreshAfterMonitoringWrite(queryClient, response.student),
    onError: (error) => refreshAfterFailure(queryClient, error),
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEntry(id),
    onSuccess: (response) => refreshAfterMonitoringWrite(queryClient, response.student),
    onError: (error) => refreshAfterFailure(queryClient, error),
  });
}

export function useSetRequiredHours(studentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requiredHours: number | string | null) => setRequiredHours(studentId, requiredHours),
    onSuccess: (response) => refreshAfterMonitoringWrite(queryClient, response.student),
    onError: (error) => refreshAfterFailure(queryClient, error),
  });
}
