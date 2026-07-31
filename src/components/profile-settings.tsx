"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, KeyRound, LoaderCircle, LogOut, Mail, Save } from "lucide-react";
import { toast } from "sonner";
import {
  sendOwnPasswordResetLink,
  signOutAllDevices,
  updateOwnProfile,
  uploadProfileAvatar
} from "@/actions/profile-actions";
import { formatThaiDate, initials } from "@/lib/format";
import type { Profile } from "@/types/app";

export function ProfileSettings({ user }: { user: Profile }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [contactInfo, setContactInfo] = useState(user.contact_info ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [saving, startSaving] = useTransition();
  const [uploading, startUploading] = useTransition();
  const [sendingReset, startSendingReset] = useTransition();
  const [signingOut, startSigningOut] = useTransition();
  const [resetCooldown, setResetCooldown] = useState(0);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  function saveProfile() {
    if (saving || !displayName.trim()) return;
    startSaving(async () => {
      const result = await updateOwnProfile({ display_name: displayName, contact_info: contactInfo });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function uploadAvatar(file: File | undefined) {
    if (!file || uploading) return;
    const previewUrl = URL.createObjectURL(file);
    const previousUrl = avatarUrl;
    setAvatarUrl(previewUrl);

    startUploading(async () => {
      const formData = new FormData();
      formData.set("avatar", file);
      const result = await uploadProfileAvatar(formData);
      URL.revokeObjectURL(previewUrl);
      if (!result.ok) {
        setAvatarUrl(previousUrl);
        toast.error(result.message);
        return;
      }
      setAvatarUrl(result.data.avatar_url);
      toast.success(result.message);
      router.refresh();
    });
  }

  function sendResetLink() {
    if (sendingReset || resetCooldown > 0) return;
    startSendingReset(async () => {
      const result = await sendOwnPasswordResetLink();
      if (result.ok) {
        setResetCooldown(60);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-10">
      <div className="mb-7">
        <p className="text-sm font-medium text-apple-blue">บัญชีของฉัน</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-normal text-apple-text">โปรไฟล์สมาชิก</h1>
      </div>

      <section className="overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
        <div className="border-b border-apple-line px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-apple-text">ข้อมูลส่วนตัว</h2>
          <p className="mt-1 text-sm text-apple-muted">ข้อมูลนี้ใช้แสดงกับสมาชิกคนอื่นภายใน Task</p>
        </div>

        <div className="grid gap-7 p-5 sm:grid-cols-[160px_1fr] sm:p-6">
          <div>
            <div className="relative h-28 w-28 overflow-hidden rounded-full border border-apple-line bg-apple-bg">
              {avatarUrl ? (
                <Image unoptimized fill sizes="112px" src={avatarUrl} alt={`รูปโปรไฟล์ของ ${displayName || user.email}`} className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-apple-text">
                  {initials(displayName || user.email)}
                </span>
              )}
            </div>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                uploadAvatar(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex items-center gap-2 rounded-lg border border-apple-line bg-white px-3 py-2 text-sm font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-60"
            >
              {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? "กำลังอัปโหลด..." : "เปลี่ยนรูป"}
            </button>
            <p className="mt-2 text-xs leading-5 text-apple-muted">JPG, PNG หรือ WebP ไม่เกิน 2 MB</p>
          </div>

          <form action={saveProfile} className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-apple-text">Display Name</span>
              <input
                required
                maxLength={120}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-apple-text">เบอร์โทรหรือช่องทางติดต่อ</span>
              <input
                maxLength={200}
                value={contactInfo}
                onChange={(event) => setContactInfo(event.target.value)}
                placeholder="เช่น 08x-xxx-xxxx หรือ LINE ID"
                className="mt-2 w-full rounded-lg border border-apple-line bg-white px-4 py-3 text-sm outline-none transition focus:border-apple-blue"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-apple-text">อีเมล</span>
              <input
                readOnly
                value={user.email}
                className="mt-2 w-full cursor-not-allowed rounded-lg border border-apple-line bg-apple-bg px-4 py-3 text-sm text-apple-muted outline-none"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || !displayName.trim()}
                className="flex items-center gap-2 rounded-lg bg-apple-blue px-5 py-3 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-apple-line bg-white shadow-panel">
        <div className="border-b border-apple-line px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-apple-text">รหัสผ่านและการเข้าสู่ระบบ</h2>
          <p className="mt-1 text-sm text-apple-muted">
            เปลี่ยนรหัสผ่านล่าสุด: {user.password_changed_at ? formatThaiDate(user.password_changed_at) : "ยังไม่มีข้อมูล"}
          </p>
        </div>
        <div className="divide-y divide-apple-line">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-apple-blue" />
              <div>
                <p className="font-medium text-apple-text">ส่งลิงก์เปลี่ยนรหัสผ่าน</p>
                <p className="mt-1 text-sm text-apple-muted">ระบบจะส่งลิงก์ไปที่ {user.email}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={sendingReset || resetCooldown > 0}
              onClick={sendResetLink}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-apple-line px-4 py-2.5 text-sm font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-60"
            >
              {sendingReset ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {sendingReset ? "กำลังส่ง..." : resetCooldown > 0 ? `ส่งใหม่ได้ใน ${resetCooldown} วินาที` : "ส่งลิงก์"}
            </button>
          </div>

          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3">
              <LogOut className="mt-0.5 h-5 w-5 shrink-0 text-apple-red" />
              <div>
                <p className="font-medium text-apple-text">ออกจากระบบทุกอุปกรณ์</p>
                <p className="mt-1 text-sm text-apple-muted">ยกเลิกเซสชันที่ใช้งานอยู่ในอุปกรณ์อื่นทั้งหมด</p>
              </div>
            </div>
            <form
              action={() => {
                if (signingOut) return;
                startSigningOut(async () => signOutAllDevices());
              }}
            >
              <button
                type="submit"
                disabled={signingOut}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-apple-red px-4 py-2.5 text-sm font-semibold text-apple-red hover:bg-red-50 disabled:opacity-60 sm:w-auto"
              >
                {signingOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {signingOut ? "กำลังออกจากระบบ..." : "ออกจากระบบทุกอุปกรณ์"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
