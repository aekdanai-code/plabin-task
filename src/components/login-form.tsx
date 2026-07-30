"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [remember, setRemember] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) toast.error(error);
  }, [searchParams]);

  function onSubmit(formData: FormData) {
    if (isPending) return;
    startTransition(async () => {
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const password = String(formData.get("password") ?? "");
      const displayName = String(formData.get("display_name") ?? "").trim();
      try {
        const supabase = createClient();
        const response =
          mode === "login"
            ? await supabase.auth.signInWithPassword({ email, password })
            : await supabase.auth.signUp({
                email,
                password,
                options: { data: { display_name: displayName || email.split("@")[0] } }
              });

        if (response.error) {
          toast.error(response.error.message);
          return;
        }

        if (!remember) {
          sessionStorage.setItem("plabin-session-only", "true");
        } else {
          sessionStorage.removeItem("plabin-session-only");
        }

        if (mode === "register" && !response.data.session) {
          toast.success("สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
          router.replace("/login");
        } else {
          toast.success(mode === "login" ? "เข้าสู่ระบบสำเร็จ" : "สร้างบัญชีสำเร็จ");
          router.replace(searchParams.get("next") || "/");
        }
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error && error.message === "SUPABASE_NOT_CONFIGURED"
            ? "ยังไม่ได้ตั้งค่า Supabase ในไฟล์ .env.local"
            : "เชื่อมต่อ Supabase ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่";
        toast.error(message);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {mode === "register" ? (
        <label className="block">
          <span className="text-sm font-medium text-apple-text">ชื่อที่แสดง</span>
          <input
            className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
            name="display_name"
            placeholder="เช่น Plabin Admin"
          />
        </label>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-apple-text">อีเมล</span>
        <input
          required
          className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
          name="email"
          type="email"
          placeholder="name@example.com"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-apple-text">รหัสผ่าน</span>
        <input
          required
          minLength={6}
          className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
          name="password"
          type="password"
          placeholder="อย่างน้อย 6 ตัวอักษร"
        />
      </label>
      {mode === "login" ? (
        <label className="flex items-center justify-between rounded-lg bg-apple-bg px-4 py-3 text-sm text-apple-muted">
          <span>Remember me</span>
          <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" className="h-5 w-5 accent-apple-blue" />
        </label>
      ) : null}
      <button
        className="w-full rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "กำลังดำเนินการ..." : mode === "login" ? "เข้าสู่ระบบ" : "สมัครใช้งาน"}
      </button>
    </form>
  );
}
