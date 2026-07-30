import { AppHeader } from "@/components/app-header";
import { getNotificationPreferences, getNotifications } from "@/actions/notification-actions";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [notifications, preferences] = await Promise.all([getNotifications(), getNotificationPreferences()]);
  return (
    <div className="min-h-screen">
      <AppHeader
        user={user}
        notifications={notifications.ok ? notifications.data : []}
        preferences={preferences.ok ? preferences.data : { task_shared: true, task_updated: true }}
      />
      {children}
    </div>
  );
}
