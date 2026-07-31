"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetRequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending || !email.trim()) return;
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/update-password`
        });
        if (error) {
          const message = error.message.toLowerCase().includes("rate limit")
            ? "ส่งอีเมลบ่อยเกินไป กรุณารอแล้วลองใหม่อีกครั้ง"
            : error.message;
          toast.error(message);
          return;
        }
        setSent(true);
        toast.success("ส่งลิงก์เปลี่ยนรหัสผ่านแล้ว");
      } catch {
        toast.error("เชื่อมต่อระบบยืนยันตัวตนไม่สำเร็จ");
      }
    });
  }

  return sent ? (
    <div className="rounded-lg bg-green-50 px-4 py-4 text-sm leading-6 text-green-800">
      ตรวจสอบกล่องจดหมายของคุณ แล้วเปิดลิงก์เพื่อกำหนดรหัสผ่านใหม่
    </div>
  ) : (
    <form action={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-apple-text">อีเมล</span>
        <div className="relative mt-2">
          <Mail className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-apple-muted" />
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-lg border border-apple-line bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-apple-blue"
          />
        </div>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {pending ? "กำลังส่ง..." : "ส่งลิงก์เปลี่ยนรหัสผ่าน"}
      </button>
    </form>
  );
}
