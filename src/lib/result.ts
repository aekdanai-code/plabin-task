import type { ActionResult } from "@/types/app";

export function ok<T>(data: T, message = "สำเร็จ"): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(code: string, message: string): ActionResult<never> {
  return { ok: false, code, message };
}

export function toErrorResult(error: unknown, fallback = "เกิดข้อผิดพลาด"): ActionResult<never> {
  if (error instanceof Error) {
    return fail("SERVER_ERROR", error.message || fallback);
  }
  return fail("SERVER_ERROR", fallback);
}
