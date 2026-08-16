import { AppHeader } from "@/components/app-header";
import { getNotifications } from "@/actions/notification-actions";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const notifications = await getNotifications();
  return (
    <div className="min-h-screen">
      <AppHeader
        user={user}
        notifications={notifications.ok ? notifications.data : []}
      />
      {children}
    </div>
  );
}
