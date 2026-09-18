export const TASK_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const TASK_IMAGE_MAX_COUNT = 10;
export const TASK_IMAGE_BUCKET = "task-images";
export const TASK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function imageValidationError(file: { size: number; type: string }): string | null {
  if (!(TASK_IMAGE_TYPES as readonly string[]).includes(file.type)) return "รองรับเฉพาะ JPG, PNG และ WebP";
  if (file.size === 0) return "ไฟล์รูปภาพว่างเปล่า";
  if (file.size > TASK_IMAGE_MAX_BYTES) return "รูปภาพต้องมีขนาดไม่เกิน 3 MB ต่อรูป";
  return null;
}

export type TaskImage = {
  id: string;
  task_id: string | null;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sort_order: number;
};

export function taskImageUrl(id: string, thumbnail = false) {
  return `/api/task-images/${encodeURIComponent(id)}${thumbnail ? "?thumbnail=1" : ""}`;
}
