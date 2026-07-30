import Link from "next/link";
import { PasswordResetRequestForm } from "@/components/password-reset-request-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-apple-line bg-white p-8 shadow-panel">
        <h1 className="text-3xl font-semibold text-apple-text">ลืมรหัสผ่าน</h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-apple-muted">ระบุอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับกำหนดรหัสผ่านใหม่ให้คุณ</p>
        <PasswordResetRequestForm />
        <Link className="mt-6 inline-flex text-sm font-medium text-apple-blue hover:underline" href="/login">
          กลับไป Login
        </Link>
      </section>
    </main>
  );
}
