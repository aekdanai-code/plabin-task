import type { Profile, TaskPermission, TaskSummary } from "@/types/app";

export function taskAccess(task: Pick<TaskSummary, "owner_id" | "access_level">, user: Pick<Profile, "id">): TaskPermission | "NONE" {
  if (task.owner_id === user.id) return "OWNER";
  return task.access_level ?? "NONE";
}

export function canEditTask(access: TaskPermission | "NONE") {
  return access === "OWNER" || access === "EDITOR";
}

export function canCheckTask(access: TaskPermission | "NONE") {
  return access === "OWNER" || access === "EDITOR" || access === "CHECKER";
}

export function canManageTask(access: TaskPermission | "NONE") {
  return access === "OWNER";
}

export function canCloneTask(access: TaskPermission | "NONE") {
  return access !== "NONE";
}
