/**
 * Request/response types for the SIMS mobile API v1.
 * Source of truth: docs/api/v1.md in the Laravel repo. Field names match it exactly.
 */

/** Role ids from the roles table (RoleSeeder): 1 Student, 2 Internship Coordinator, 3 Supervisor, 4 Administrator. */
export type RoleId = 1 | 2 | 3 | 4;

export const ROLE_STUDENT = 1 as const;
export const ROLE_COORDINATOR = 2 as const;
export const ROLE_SUPERVISOR = 3 as const;
export const ROLE_ADMIN = 4 as const;

export type RoleName = 'Student' | 'Internship Coordinator' | 'Supervisor' | 'Administrator';

export interface User {
  id: number;
  name: string;
  email: string;
  role_id: RoleId;
  role: RoleName;
}

export type InternshipStatus = 'not_started' | 'ongoing' | 'completed';

export interface IdName {
  id: number;
  name: string;
}

/**
 * Whether the student may submit attendance and reports: only while the internship is Ongoing
 * (enforced by the API). `reason` is null when allowed, else the server's refusal text.
 * Optional where it was added later, so an older server reads as "allowed" (the API still refuses).
 */
export interface SubmissionState {
  can_submit: boolean;
  internship_status: InternshipStatus | null;
  reason: string | null;
}

export interface StudentProfile {
  /** Student record id (not the user id). */
  id: number;
  student_number: string;
  course: string;
  section: string;
  internship_status: InternshipStatus;
  /** Attendance and reports are accepted only while Ongoing (see SubmissionState). */
  can_submit?: boolean;
  /** null = not set yet */
  required_hours: number | null;
  /** null = not assigned to a company yet */
  company: IdName | null;
  /** null = no supervisor assigned yet */
  supervisor: IdName | null;
}

export interface SupervisorSummary {
  students_count: number;
}

/**
 * Coordinator (2) / Administrator (4) permission flags, mirroring the website's route roles.
 * UI hints only: the API still answers 403 for anything not allowed. New flags may be added
 * within v1 (none are removed or renamed); treat a missing flag as false.
 */
export interface StaffPermissions {
  /** User Management */
  can_manage_users: boolean;
  /** Company Management + Supervisor Roster */
  can_manage_companies: boolean;
  /** Internship Assignment */
  can_assign_internships: boolean;
  /** Pending Approvals (approve / reject) */
  can_approve_attendance: boolean;
  /** Attendance Monitoring manual entries / required hours (otherwise view only) */
  can_edit_attendance: boolean;
  /** Report Reviews: the review action (viewing needs no flag) */
  can_review_reports: boolean;
  /** Create / edit / submit evaluations (otherwise view only) */
  can_write_evaluations: boolean;
  /** Lock / reopen evaluations */
  can_lock_evaluations: boolean;
  /** Evaluation Criteria screen */
  can_manage_criteria: boolean;
}

// POST /login
export interface LoginRequest {
  email: string;
  password: string;
  device_name: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// GET /me — exactly one of student / supervisor / staff is relevant to the role; the other two are null.
export interface MeResponse {
  user: User;
  /** Students only (null if the student profile isn't set up yet). */
  student: StudentProfile | null;
  /** Supervisors only. */
  supervisor: SupervisorSummary | null;
  /** Coordinators and Administrators only. */
  staff: StaffPermissions | null;
}

// Errors
/** role_not_allowed is now only sent for accounts with no / an unknown role. */
export type SessionBlockedCode = 'role_not_allowed' | 'account_inactive';

export interface ApiErrorBody {
  message?: string;
  /** 403 from the auth layer */
  code?: SessionBlockedCode | string;
  /** 422 */
  errors?: Record<string, string[]>;
  /** Endpoint-specific extras, e.g. attendance 422 code attendance_rule carries `today`. */
  [extra: string]: unknown;
}

// Notifications (Module 4)

/**
 * Where tapping a notification leads, resolved by the server for the viewer's current role.
 * `screen` is a FeatureKey from src/navigation/access.ts (new keys may appear; unknown ones are
 * ignored). `params` holds int ids that are only highlight hints (the record may be gone),
 * e.g. { attendance_id: 12 } or { report_id: 7 }; {} when there's nothing to highlight.
 */
export interface NotificationTarget {
  screen: string;
  params: Record<string, number>;
}

export interface AppNotification {
  id: number;
  type: string;
  title: string;
  message: string | null;
  /** ISO 8601 (+08:00); null = unread */
  read_at: string | null;
  /** ISO 8601 (+08:00) */
  created_at: string;
  /** null = nothing to open for this type / role */
  target: NotificationTarget | null;
}

// GET /notifications?unread=&per_page=&cursor= — cursor pagination, newest first.
export interface NotificationsPage {
  data: AppNotification[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
  };
}

// GET /notifications/unread-count
export interface UnreadCountResponse {
  count: number;
}

// POST /notifications/{id}/read
export interface MarkReadResponse {
  notification: AppNotification;
  unread_count: number;
}

// POST /notifications/read-all
export interface MarkAllReadResponse {
  marked: number;
  unread_count: number;
}

// Dashboards & Analytics (Module 5)

/** One KPI number; `trend` is the month-over-month % change where the web shows one, else null. */
export interface Kpi {
  value: number;
  trend: number | null;
}

export interface AttendanceSummaryKpi {
  present: number;
  rejected: number;
}

export type AttendanceStatus = 'pending' | 'approved' | 'rejected';

export interface DashboardHours {
  rendered: number;
  /** null = not set yet */
  required: number | null;
  remaining: number | null;
  /** min(round(rendered / required * 100), 100); null when required is not set */
  progress_percent: number | null;
}

export interface TodayAttendance {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** ISO 8601 (+08:00) */
  time_in: string | null;
  time_in_status: AttendanceStatus | null;
  time_out: string | null;
  time_out_status: AttendanceStatus | null;
}

export interface DashboardReportRow {
  id: number;
  type: 'daily' | 'weekly' | string;
  /** YYYY-MM-DD */
  period_start: string;
  period_end: string;
  status: 'pending' | 'reviewed' | string;
}

export interface StudentDashboard {
  internship: {
    status: InternshipStatus;
    /** Attendance and reports are accepted only while Ongoing. */
    can_submit?: boolean;
    company: IdName | null;
    supervisor: IdName | null;
  };
  hours: DashboardHours;
  today_attendance: TodayAttendance | null;
  reports: { pending: number; reviewed: number };
  /** Latest 5 by period_start */
  recent_reports: DashboardReportRow[];
}

export interface SupervisorKpis {
  assigned_students: Kpi;
  active_internships: Kpi;
  todays_attendance: Kpi;
  pending_attendance_approvals: Kpi;
  reports_awaiting_review: Kpi;
  pending_evaluations: Kpi;
  completed_evaluations: Kpi;
  students_requiring_attention: Kpi;
}

export interface CoordinatorKpis {
  total_students: Kpi;
  active_internship_assignments: Kpi;
  companies: Kpi;
  active_supervisors: Kpi;
  students_without_company: Kpi;
  pending_approvals: Kpi;
  attendance_summary: AttendanceSummaryKpi;
  /** value = percent with 1 decimal */
  internship_completion_progress: Kpi;
  reports_awaiting_review: Kpi;
  students_requiring_attention: Kpi;
}

export interface AdminKpis {
  total_students: Kpi;
  total_companies: Kpi;
  total_supervisors: Kpi;
  active_internship_assignments: Kpi;
  completed_internships: Kpi;
  pending_approvals: Kpi;
  attendance_summary: AttendanceSummaryKpi;
  students_nearing_completion: Kpi;
  students_with_attendance_issues: Kpi;
  pending_supervisor_evaluations: Kpi;
}

export interface SupervisedStudentRow {
  id: number;
  name: string | null;
  internship_status: InternshipStatus;
  rendered_hours: number;
  required_hours: number | null;
  progress_percent: number | null;
}

export interface ActionItem {
  key: string;
  /** Same text as the website, e.g. "3 attendance approval(s) awaiting your action" */
  label: string;
  count: number;
  target: NotificationTarget | null;
}

/** A notification on the dashboard feed; a supervisor also sees their students' ones (is_own = false). */
export interface ActivityItem extends AppNotification {
  is_own: boolean;
}

interface DashboardBase {
  action_items: ActionItem[];
  recent_activity: ActivityItem[];
}

// GET /dashboard — every key is always present; the ones that don't apply to the role are null / [].
export type DashboardResponse =
  | (DashboardBase & { role_id: 1; student: StudentDashboard | null; kpis: null; supervised_students: null })
  | (DashboardBase & { role_id: 3; student: null; kpis: SupervisorKpis; supervised_students: SupervisedStudentRow[] })
  | (DashboardBase & { role_id: 2; student: null; kpis: CoordinatorKpis; supervised_students: null })
  | (DashboardBase & { role_id: 4; student: null; kpis: AdminKpis; supervised_students: null });

export interface AnalyticsFilters {
  /** YYYY-MM-DD */
  date_from: string | null;
  date_to: string | null;
  company_id: number | null;
  supervisor_id: number | null;
  student_id: number | null;
}

export interface ChartPoint {
  key: string;
  label: string;
  value: number;
}

// GET /analytics?date_from=&date_to=&company_id=&supervisor_id=&student_id= (roles 2, 3, 4)
export interface AnalyticsResponse {
  /** As resolved by the server (supervisor_id = self for supervisors). */
  filters: AnalyticsFilters;
  internship: {
    status_breakdown: ChartPoint[];
    /** Top 10 */
    students_by_company: ChartPoint[];
    /** Always 5 buckets: 0-25%, 25-50%, 50-75%, 75-100%, 100%+ */
    completion_progress: ChartPoint[];
  };
  attendance: {
    outcomes: ChartPoint[];
    /** Only days with rows; default range = last 30 days */
    trend: { date: string; present: number; rejected: number }[];
    frequent_rejections: { student_id: number; name: string | null; rejection_count: number }[];
  };
  evaluation: {
    /** draft | submitted | locked */
    completion: ChartPoint[];
    /** value = average rating (1–5), 2 decimals */
    by_category: ChartPoint[];
  };
  reports: {
    /** pending | reviewed */
    funnel: ChartPoint[];
    submission_trend: { date: string; value: number }[];
  };
}

// GET /analytics/filter-options (already scoped for a supervisor)
export interface AnalyticsFilterOptions {
  companies: IdName[];
  supervisors: IdName[];
  students: { id: number; name: string | null; student_number: string }[];
}

// Attendance (Module 6, Student)

export type AttendanceLeg = 'time_in' | 'time_out';
export type AttendanceAction = 'time_in' | 'time_out' | 'emergency_time_out';

/** One day's attendance record, flat like the website's (GET /attendance, /attendance/today). */
export interface AttendanceRecord {
  id: number;
  /** YYYY-MM-DD (Manila) */
  date: string;
  /** ISO 8601 with +08:00 */
  time_in: string | null;
  time_in_status: AttendanceStatus | null;
  time_in_rejection_reason: string | null;
  time_in_latitude: number | null;
  time_in_longitude: number | null;
  /** metres */
  time_in_accuracy: number | null;
  /** Android's fake-GPS flag; null = unknown (website, staff entry, or not reported) */
  time_in_mocked: boolean | null;
  /** Absolute API URL; fetch with the Bearer header. */
  time_in_photo_url: string | null;
  time_out: string | null;
  time_out_status: AttendanceStatus | null;
  time_out_rejection_reason: string | null;
  time_out_latitude: number | null;
  time_out_longitude: number | null;
  time_out_accuracy: number | null;
  time_out_mocked: boolean | null;
  time_out_photo_url: string | null;
  /** Set only when both legs are approved. */
  rendered_hours: number | null;
  is_emergency: boolean;
  note: string | null;
}

export interface AttendanceActionState {
  allowed: boolean;
  /** null when allowed; otherwise the server's rule message, shown as-is */
  reason: string | null;
}

export interface AttendanceToday {
  /** YYYY-MM-DD (Manila) */
  date: string;
  record: AttendanceRecord | null;
  actions: Record<AttendanceAction, AttendanceActionState>;
  hours: { rendered: number; required: number | null; remaining: number | null };
  /** When not Ongoing every action is { allowed: false, reason: <Ongoing message> }; this drives the banner. */
  submission?: SubmissionState;
}

/** POST /attendance/{time-in|time-out|emergency-time-out} → message + the fresh today state. */
export interface AttendanceSubmitResponse extends AttendanceToday {
  message: string;
}

export interface AttendancePage {
  data: AttendanceRecord[];
  meta: { per_page: number; next_cursor: string | null; has_more: boolean };
}

// Reports (Module 7, Student)

export type ReportType = 'daily' | 'weekly';
export type ReportStatus = 'pending' | 'reviewed';

export interface ReportAttachment {
  /** Original file name, e.g. "proof.pdf" */
  name: string;
  /** image/jpeg, image/png or application/pdf */
  mime: string;
  /** 'file' is a fallback for any other stored type (validation only lets images and PDFs in). */
  kind: 'image' | 'pdf' | 'file';
  /** bytes */
  size: number;
  /** Absolute API URL with a ?v= fingerprint that changes when the file is replaced; fetch with the Bearer header. */
  url: string;
}

export interface Report {
  id: number;
  type: ReportType;
  /** YYYY-MM-DD; for a daily report period_end equals period_start */
  period_start: string;
  period_end: string;
  content: string;
  status: ReportStatus;
  reviewer_comment: string | null;
  /** null when not reviewed (or the reviewer's account was deleted) */
  reviewer: IdName | null;
  /** ISO 8601 (+08:00) */
  reviewed_at: string | null;
  attachment: ReportAttachment | null;
  created_at: string;
  updated_at: string;
  /** From the server's policy (own + pending). UI hints only; the server re-checks. */
  can_edit: boolean;
  can_delete: boolean;
}

export interface ReportFilters {
  type: ReportType | null;
  status: ReportStatus | null;
}

// GET /reports?type=&status=&per_page=&cursor= — period_start desc, then id desc.
export interface ReportsPage {
  data: Report[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
    /** New / Edit report are accepted only while Ongoing. */
    submission?: SubmissionState;
  };
}

// POST /reports, POST /reports/{id} (_method=PATCH)
export interface ReportSaveResponse {
  message: string;
  report: Report;
}

// ---------------------------------------------------------------------------
// Report Reviews (Module 11): Supervisor own students (view only), Coordinator + Admin review.
// ---------------------------------------------------------------------------

export interface ReviewReportStudent {
  /** students.id (the same id /monitoring/students returns) */
  id: number;
  user_id: number;
  name: string;
  student_number: string | null;
  course: string | null;
  section: string | null;
  company: IdName | null;
}

/** The Module 7 report (can_edit / can_delete always false for staff) plus its student and the review flag. */
export interface ReviewReport extends Report {
  student: ReviewReportStudent;
  /** Coordinator / Admin and still pending. UI hint only; the server re-checks. */
  can_review: boolean;
}

export interface ReviewReportFilters {
  status: ReportStatus | null;
  type: ReportType | null;
  /** students.id; a filter only (the server still scopes a Supervisor to their own students). */
  studentId: number | null;
  /** Student name or number, "contains" (max 255). */
  search: string;
}

// GET /report-reviews — pending first, then period_start desc, then id desc.
export interface ReviewReportsPage {
  data: ReviewReport[];
  meta: { per_page: number; next_cursor: string | null; has_more: boolean };
}

// POST /report-reviews/{id}/review; 422 code report_not_pending carries the fresh `report` too.
export interface ReviewReportResponse {
  message: string;
  report: ReviewReport;
}

// ---------------------------------------------------------------------------
// My Feedback (Module 8): GET /feedback, GET /feedback/{id}. Student only.
// ---------------------------------------------------------------------------

/** Students only ever see submitted or locked evaluations (drafts never appear). */
export type FeedbackStatus = 'submitted' | 'locked';

export interface FeedbackSummary {
  id: number;
  /** "YYYY-MM-DD" (Manila) */
  period_start: string;
  period_end: string;
  status: FeedbackStatus;
  /** Average of the 1-5 ratings, 2 dp. */
  overall_rating: number | null;
  rating_max: number;
  supervisor: { id: number; name: string } | null;
  company: { id: number; name: string } | null;
  /** ISO 8601 with +08:00 */
  submitted_at: string | null;
  locked_at: string | null;
}

export interface FeedbackCriterion {
  id: number;
  label: string;
  description: string | null;
  rating: number | null;
  max: number;
  comment: string | null;
}

export interface FeedbackCategory {
  category: string;
  criteria: FeedbackCriterion[];
}

export interface FeedbackDetail extends FeedbackSummary {
  strengths: string | null;
  areas_for_improvement: string | null;
  recommendations: string | null;
  supervisor_remarks: string | null;
  /** Saved ratings in the website's order, grouped by category. */
  categories: FeedbackCategory[];
}

export interface FeedbackPage {
  data: FeedbackSummary[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
  };
}

// Pending Approvals (Module 9) — roles 3 (own students) and 4 (all); 403 for others.

export interface ApprovalLegReview {
  /** True only when the leg is pending and this user may review it. */
  can_approve: boolean;
  can_reject: boolean;
}

/** An attendance record to review: the Module 6 record plus who it belongs to and what may be decided. */
export interface ApprovalItem extends AttendanceRecord {
  student: {
    id: number;
    name: string;
    student_number: string | null;
    company: { id: number; name: string } | null;
  };
  /** Pending legs, in time_in, time_out order; [] once both are decided. */
  pending_legs: AttendanceLeg[];
  review: Record<AttendanceLeg, ApprovalLegReview>;
}

// GET /approvals?per_page=&cursor= — records with a pending leg, newest date first.
export interface ApprovalsPage {
  data: ApprovalItem[];
  meta: {
    per_page: number;
    next_cursor: string | null;
    has_more: boolean;
  };
}

// GET /approvals/count — records with a pending leg (same as the dashboard KPI).
export interface ApprovalCountResponse {
  count: number;
}

// GET /approvals/{id}
export interface ApprovalResponse {
  data: ApprovalItem;
}

export type ApprovalDecision = 'approve' | 'reject';

// POST /attendance/{id}/{time-in|time-out}/{approve|reject}; 422 code attendance_rule carries a fresh `attendance` too.
export interface ApprovalDecisionResponse {
  message: string;
  attendance: ApprovalItem;
}

// Attendance & Progress Monitoring (Module 10: Supervisor own students, Coordinator view only, Admin all)

/** GET /monitoring/students, /monitoring/students/{id}, /progress: one student with hours progress. */
export interface MonitoredStudent {
  id: number;
  user_id: number;
  name: string;
  student_number: string | null;
  course: string | null;
  section: string | null;
  internship_status: InternshipStatus | null;
  company: { id: number; name: string } | null;
  supervisor: { id: number; name: string } | null;
  /** Sum of approved days, 2 dp */
  rendered_hours: number;
  required_hours: number | null;
  /** max(required - rendered, 0); null when required isn't set */
  remaining_hours: number | null;
  /** Website bar: 0-100 capped, 0 when required is 0, null when not set */
  progress_percent: number | null;
  /** Add / edit / delete entries (Admin, the student's own Supervisor; never a Coordinator) */
  can_edit_attendance: boolean;
  can_edit_required_hours: boolean;
}

/** Page-numbered (not cursor) like the website's table. */
export interface MonitoredStudentsPage {
  data: MonitoredStudent[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean };
}

export interface MonitoredStudentResponse {
  data: MonitoredStudent;
}

/** The attendance record of /attendance/history plus the website's Recorded By column and write flags. */
export interface MonitoringAttendance extends AttendanceRecord {
  recorded_by: 'self' | 'staff';
  can_edit: boolean;
  can_delete: boolean;
}

export interface MonitoringAttendancePage {
  data: MonitoringAttendance[];
  meta: { per_page: number; next_cursor: string | null; has_more: boolean };
}

/** POST /monitoring/students/{id}/attendance, PATCH /monitoring/attendance/{id} */
export interface AttendanceEntryResponse {
  message: string;
  attendance: MonitoringAttendance;
  student: MonitoredStudent;
}

/** DELETE /monitoring/attendance/{id}, PATCH /monitoring/students/{id}/required-hours */
export interface MonitoredStudentWriteResponse {
  message: string;
  student: MonitoredStudent;
}

// ---------------------------------------------------------------------------
// Supervisor Evaluations & Evaluation Criteria (Module 12).
// Supervisor: own students, create / edit draft / submit. Coordinator: view only.
// Admin: all, create / edit draft / submit, lock / reopen, criteria.
// The can_* flags are UI hints; the server re-checks everything.
// ---------------------------------------------------------------------------

export type EvaluationStatus = 'draft' | 'submitted' | 'locked';

export interface EvaluationSummary {
  id: number;
  status: EvaluationStatus;
  /** "YYYY-MM-DD" (Manila) */
  period_start: string;
  period_end: string;
  /** Average of the 1-5 ratings, 2 dp. */
  overall_rating: number | null;
  rating_max: number;
  /** Never null in practice (the API allows it). */
  student: { id: number; user_id: number; name: string; student_number: string | null } | null;
  company: { id: number; name: string } | null;
  supervisor: { id: number; name: string } | null;
  /** ISO 8601 with +08:00 */
  submitted_at: string | null;
  locked_at: string | null;
  locked_by: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
  can_edit: boolean;
  can_submit: boolean;
  can_lock: boolean;
  can_reopen: boolean;
}

export interface EvaluationResponseInput {
  evaluation_criteria_id: number;
  rating: number;
  comment: string | null;
}

export interface EvaluationDetail extends EvaluationSummary {
  strengths: string | null;
  areas_for_improvement: string | null;
  recommendations: string | null;
  supervisor_remarks: string | null;
  /** The evaluation's own saved ratings (including deactivated criteria), grouped by category. */
  categories: FeedbackCategory[];
  /** Saved responses, to prefill the edit form. */
  responses: EvaluationResponseInput[];
}

export interface EvaluationFilters {
  status: EvaluationStatus | null;
  /** students.id (a supervisor's Students tab could pass it; the server still scopes). */
  studentId: number | null;
  /** Student name or number, "contains" (max 255). */
  search: string;
}

// GET /evaluations — period_start desc, then id desc.
export interface EvaluationsPage {
  data: EvaluationSummary[];
  meta: { per_page: number; next_cursor: string | null; has_more: boolean };
  /** Supervisor / Admin: may start a new evaluation. */
  can_create: boolean;
}

/** An active criterion the form rates. */
export interface EvaluationCriterion {
  id: number;
  label: string;
  description: string | null;
  sort_order: number;
}

// GET /evaluations/criteria — active only, category asc then sort_order.
export interface EvaluationCriteriaResponse {
  rating_max: number;
  categories: { category: string; criteria: EvaluationCriterion[] }[];
}

/** GET /evaluations/students: whom the user may start an evaluation for (Supervisor: own; Admin: all). */
export interface EvaluableStudent {
  id: number;
  user_id: number;
  name: string;
  student_number: string | null;
  company: { id: number; name: string } | null;
}

// POST /evaluations, PATCH /evaluations/{id}, POST /evaluations/{id}/{submit|lock|reopen}.
// A state refusal is 422 code evaluation_rule with the fresh `evaluation` (no `errors`).
export interface EvaluationWriteResponse {
  message: string;
  evaluation: EvaluationDetail;
}

/** Evaluation Criteria management (Admin): every criterion, active or not. */
export interface ManagedCriterion extends EvaluationCriterion {
  category: string;
  is_active: boolean;
  responses_count: number;
}

export interface CriterionWriteResponse {
  message: string;
  criterion: ManagedCriterion | null;
  /** DELETE only: false when it had responses and was deactivated instead. */
  deleted?: boolean;
}

// ---------------------------------------------------------------------------
// User Management (Module 13): Coordinator + Admin, /me staff.can_manage_users.
// Coordinators never see Administrator accounts (404) or the Administrator role.
// ---------------------------------------------------------------------------

export type UserStatus = 'active' | 'inactive';

export interface RoleOption {
  id: number;
  role_name: string;
}

/** One account in GET /users and GET /users/{id}. The flags are the server's decision. */
export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role_id: number | null;
  /** Role display name, e.g. "Supervisor" (same as /me). */
  role: string | null;
  status: UserStatus;
  /** ISO 8601 */
  created_at: string | null;
  /** The signed-in user's own account. */
  is_self: boolean;
  can_edit: boolean;
  /** False on yourself. */
  can_toggle_status: boolean;
  /** Roles the edit form may pick for THIS user ([] when !can_edit). */
  assignable_roles: RoleOption[];
}

export interface UserFilters {
  search: string;
  roleId: number | null;
  status: UserStatus | null;
}

/** GET /users: page pagination, newest first. */
export interface UsersPage {
  data: ManagedUser[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean };
  can_create: boolean;
  /** Roles for "Filter by Role" (ordered by name; Administrator hidden from coordinators). */
  roles: RoleOption[];
  /** Roles the create form may pick (never Student; no Administrator for coordinators). */
  create_roles: RoleOption[];
}

/** GET /users/roles */
export interface UserRolesResponse {
  roles: RoleOption[];
  create_roles: RoleOption[];
}

/** POST /users, PATCH /users/{id}, POST /users/{id}/{activate|deactivate}. */
export interface UserWriteResponse {
  message: string;
  user: ManagedUser;
}

// ---------------------------------------------------------------------------
// Company Management & Supervisor Roster (Module 14): Coordinator + Admin,
// /me staff.can_manage_companies.
// ---------------------------------------------------------------------------

export type CompanyStatus = 'active' | 'inactive';

/** A Supervisor account that can be added to a roster (GET /companies/{id}/supervisors/available). */
export interface AvailableSupervisor {
  id: number;
  name: string;
  email: string;
  /** Inactive supervisors are listed too, as on the website. */
  status: 'active' | 'inactive';
}

/** A supervisor on a company's roster (sorted by name). */
export interface RosterSupervisor extends AvailableSupervisor {
  /** How many of THIS company's students this person supervises (kept when removed from the roster). */
  students_count: number;
}

export type CompanyDeleteBlockedReason = 'company_has_students' | 'company_has_evaluations';

/** One company in GET /companies and GET /companies/{id}. The flags are the server's decision. */
export interface ManagedCompany {
  id: number;
  company_name: string;
  address: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  industry: string | null;
  /** Internship slots (total). */
  slots: number;
  /** Students assigned to this company (slots used). */
  students_count: number;
  /** max(0, slots - students_count) */
  slots_available: number;
  status: CompanyStatus;
  supervisors: RosterSupervisor[];
  supervisors_count: number;
  /** ISO 8601 */
  created_at: string | null;
  updated_at: string | null;
  can_edit: boolean;
  can_toggle_status: boolean;
  can_manage_roster: boolean;
  can_delete: boolean;
  /** Why Delete is refused (null when can_delete). */
  delete_blocked_reason: CompanyDeleteBlockedReason | null;
}

export interface CompanyFilters {
  search: string;
  status: CompanyStatus | null;
}

/** GET /companies: page pagination, ordered by company name. */
export interface CompaniesPage {
  data: ManagedCompany[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean };
  can_create: boolean;
}

/** POST /companies, PATCH /companies/{id}, activate/deactivate, roster attach/detach. */
export interface CompanyWriteResponse {
  message: string;
  company: ManagedCompany;
}

// ---------------------------------------------------------------------------
// Internship Assignment (Module 15): Coordinator + Admin, /me staff.can_assign_internships.
// `id` is the STUDENT record id (not the user id).
// ---------------------------------------------------------------------------

export interface AssignmentCompany {
  id: number;
  company_name: string;
  status: CompanyStatus;
}

export interface AssignmentSupervisor {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
}

/** One student in GET /assignments and GET /assignments/{id}. The flags are the server's decision. */
export interface AssignmentStudent {
  id: number;
  user_id: number;
  /** null only if the account is missing. */
  name: string | null;
  email: string | null;
  /** Account status. */
  status: 'active' | 'inactive';
  student_number: string;
  course: string;
  section: string;
  company: AssignmentCompany | null;
  supervisor: AssignmentSupervisor | null;
  /** null when no supervisor; false = the supervisor was later removed from the company's roster (still valid). */
  supervisor_on_roster: boolean | null;
  /**
   * Has a company but no supervisor, or one no longer on its roster (never true without a company;
   * an inactive supervisor alone doesn't count). Same rows as the needs_supervisor=1 filter.
   */
  needs_supervisor: boolean;
  internship_status: InternshipStatus;
  internship_schedule: string | null;
  /** ISO 8601 */
  created_at: string | null;
  updated_at: string | null;
  can_edit: boolean;
  can_toggle_status: boolean;
}

/** `company_id` / `supervisor_id`: an id, 'none' (unassigned) or null (no filter). */
export interface AssignmentFilters {
  search: string;
  internship_status: InternshipStatus | null;
  status: 'active' | 'inactive' | null;
  company_id: number | 'none' | null;
  /** true sends needs_supervisor=1 (only flagged students); false = no filter. */
  needs_supervisor: boolean;
}

/** GET /assignments: page pagination, newest student profile first. */
export interface AssignmentsPage {
  data: AssignmentStudent[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; has_more: boolean };
}

/** A company in GET /assignments/options, with its roster (both sorted by name). */
export interface AssignmentCompanyOption extends AssignmentCompany {
  slots: number;
  students_count: number;
  slots_available: number;
  supervisors: AssignmentSupervisor[];
}

/** GET /assignments/options */
export interface AssignmentOptions {
  companies: AssignmentCompanyOption[];
  internship_statuses: { value: InternshipStatus; label: string }[];
}

/** PATCH /assignments/{id}, POST /assignments/{id}/{activate|deactivate}. */
export interface AssignmentWriteResponse {
  message: string;
  student: AssignmentStudent;
}
