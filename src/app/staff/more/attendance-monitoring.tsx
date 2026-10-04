import { StudentList } from '@/features/monitoring/StudentListScreen';

/** Coordinator (view only) and Admin: Attendance Monitoring from More. */
export default function MoreAttendanceMonitoring() {
  return <StudentList kind="attendance" />;
}
