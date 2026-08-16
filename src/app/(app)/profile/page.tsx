import { ProfileSettings } from "@/components/profile-settings";
import { requireUser } from "@/lib/auth";
import { getOwnNotificationSettings } from "@/actions/notification-settings-actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const notificationSettings = await getOwnNotificationSettings();
  if (!notificationSettings.ok) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-apple-red">{notificationSettings.message}</main>;
  }
  return <ProfileSettings user={user} notificationSettings={notificationSettings.data} />;
}
