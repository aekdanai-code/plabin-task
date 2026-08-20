export type AppRole = "ADMIN" | "USER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED";
export type TaskPermission = "VIEWER" | "CHECKER" | "EDITOR" | "OWNER";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  contact_info: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  password_changed_at: string | null;
};

export type Category = {
  id: string;
  category_name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
};

export type ChecklistNote = {
  id: string;
  checklist_item_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  author?: Pick<Profile, "id" | "email" | "display_name" | "avatar_url"> | null;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  item_name: string;
  weight: number;
  is_checked: boolean;
  sort_order: number;
  checked_by: string | null;
  checked_at: string | null;
  is_deleted: boolean;
  checklist_notes?: ChecklistNote[];
};

export type TaskShare = {
  id: string;
  task_id: string;
  user_id: string;
  permission: Exclude<TaskPermission, "OWNER">;
  is_active: boolean;
  profile?: Pick<Profile, "id" | "email" | "display_name" | "avatar_url">;
};

export type ShareInput = {
  user_id: string;
  permission: Exclude<TaskPermission, "OWNER">;
};

export type NotificationType = "TASK_SHARED" | "TASK_UPDATED";

export const notificationEventTypes = [
  "TASK_SHARED",
  "TASK_UPDATED_MANUAL",
  "TASK_EDITED",
  "CHECKLIST_CHECKED",
  "CHECKLIST_UNCHECKED",
  "TASK_COMPLETED",
  "TASK_REOPENED",
  "TASK_ARCHIVED",
  "TASK_RESTORED",
  "TASK_DUE_SOON",
  "TASK_OVERDUE"
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];
export type NotificationChannel = "IN_APP" | "EMAIL" | "LINE";

export const notificationEventLabels: Record<NotificationEventType, string> = {
  TASK_SHARED: "ได้รับการแชร์ Task",
  TASK_UPDATED_MANUAL: "ทีมกดแจ้งการอัปเดต",
  TASK_EDITED: "Task ถูกแก้ไข",
  CHECKLIST_CHECKED: "Checklist ถูกติ๊ก",
  CHECKLIST_UNCHECKED: "Checklist ถูกยกเลิก",
  TASK_COMPLETED: "Task เสร็จสิ้น",
  TASK_REOPENED: "Task ถูกเปิดใหม่",
  TASK_ARCHIVED: "Task ถูก Archive",
  TASK_RESTORED: "Task ถูก Restore",
  TASK_DUE_SOON: "Task ใกล้ครบกำหนด",
  TASK_OVERDUE: "Task เกินกำหนด"
};

export type AppNotification = {
  id: string;
  user_id: string;
  task_id: string | null;
  type: NotificationType;
  event_id?: string | null;
  event_type?: NotificationEventType | null;
  title: string;
  message: string;
  created_by: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationEventRule = {
  event_type: NotificationEventType;
  display_name: string;
  description: string;
  is_enabled: boolean;
  in_app_enabled: boolean;
  email_enabled: boolean;
  line_enabled: boolean;
  cooldown_minutes: number;
  reminder_offsets_minutes: number[];
  overdue_repeat_minutes: number;
  overdue_max_occurrences: number;
  updated_at: string;
};

export type NotificationTemplate = {
  id: string;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  locale: string;
  subject_template: string;
  body_text_template: string;
  body_html_template: string | null;
  template_version: number;
  is_active: boolean;
  updated_at: string;
};

export type UserNotificationChannel = {
  user_id: string;
  email_address: string | null;
  email_verified_at: string | null;
  line_user_id: string | null;
  line_link_status: "NOT_LINKED" | "PENDING" | "LINKED" | "BLOCKED";
  line_linked_at: string | null;
  line_blocked_at: string | null;
  last_line_error: string | null;
  updated_at: string;
};

export type MemberWithLineStatus = Profile & Pick<UserNotificationChannel, "line_link_status" | "line_linked_at">;

export type TaskSummary = {
  id: string;
  task_name: string;
  description: string | null;
  category_id: string;
  owner_id: string;
  progress: number;
  status: TaskStatus;
  is_archived: boolean;
  updated_at: string;
  created_at: string;
  completed_at: string | null;
  archived_at: string | null;
  due_at: string | null;
  due_timezone: string;
  category?: Category;
  checklist_total?: number;
  checklist_done?: number;
  collaborators?: Array<Pick<Profile, "id" | "email" | "display_name" | "avatar_url">>;
  access_level?: TaskPermission;
};

export type TaskDetail = TaskSummary & {
  checklist_items: ChecklistItem[];
  shares: TaskShare[];
};

export type ActionResult<T = unknown> =
  | { ok: true; data: T; message: string }
  | { ok: false; code: string; message: string };

export type TaskFilters = {
  scope?: "mine" | "shared" | "all";
  status?: TaskStatus | "ALL";
  categoryId?: string;
  archived?: boolean;
  search?: string;
  sort?: "updated_desc" | "created_desc";
};
