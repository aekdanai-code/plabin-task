import { UpdatePasswordForm } from "@/components/update-password-form";
import { requireUser } from "@/lib/auth";

export default async function UpdatePasswordPage() {
  await requireUser();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-apple-line bg-white p-8 shadow-panel">
        <p className="text-sm font-medium text-apple-blue">Plabin Task</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal text-apple-text">กำหนดรหัสผ่านใหม่</h1>
        <p className="mb-7 mt-3 text-sm leading-6 text-apple-muted">ตั้งรหัสผ่านใหม่สำหรับบัญชีของคุณ แล้วกลับไปใช้งานระบบได้ทันที</p>
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
