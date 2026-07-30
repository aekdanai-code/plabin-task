"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { updateRecoveredPassword } from "@/actions/profile-actions";

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending) return;
    if (password !== confirmation) {
      toast.error("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    startTransition(async () => {
      const result = await updateRecoveredPassword({ password, confirm_password: confirmation });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.replace("/profile");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium text-apple-text">รหัสผ่านใหม่</span>
        <input
          required
          minLength={8}
          maxLength={72}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
          placeholder="อย่างน้อย 8 ตัวอักษร"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-apple-text">ยืนยันรหัสผ่านใหม่</span>
        <input
          required
          minLength={8}
          maxLength={72}
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
        />
      </label>
      <button
        type="submit"
        disabled={pending || password.length < 8 || confirmation.length < 8}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {pending ? "กำลังเปลี่ยนรหัสผ่าน..." : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
