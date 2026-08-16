import { getNotificationAdminData } from "@/actions/notification-settings-actions";
import { NotificationAdminSettings } from "@/components/notification-admin-settings";
import { requireAdmin } from "@/lib/auth";

export default async function SettingsPage() {
  await requireAdmin();
  const notificationSettings = await getNotificationAdminData();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-medium text-apple-muted">Admin</p>
        <h1 className="text-3xl font-semibold text-apple-text">ตั้งค่าระบบแจ้งเตือน</h1>
        <p className="mt-2 text-sm text-apple-muted">ตั้งค่า Event, ช่องทางการส่ง, Templates และตรวจสอบประวัติการส่ง</p>
      </div>
      {notificationSettings.ok ? (
        <NotificationAdminSettings initial={notificationSettings.data} />
      ) : (
        <section className="rounded-lg border border-apple-red/30 bg-white p-5 text-sm text-apple-red">
          โหลดการตั้งค่าแจ้งเตือนไม่สำเร็จ: {notificationSettings.message}
        </section>
      )}
    </main>
  );
}
