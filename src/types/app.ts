export type AppRole = "ADMIN" | "USER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "COMPLETED";
export type TaskPermission = "VIEWER" | "CHECKER" | "EDITOR" | "OWNER";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type Category = {
  id: string;
  category_name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
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

export type AppNotification = {
  id: string;
  user_id: string;
  task_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  created_by: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreferences = {
  task_shared: boolean;
  task_updated: boolean;
};

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
