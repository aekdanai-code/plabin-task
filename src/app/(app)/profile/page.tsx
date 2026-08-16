import { ProfileSettings } from "@/components/profile-settings";
import { requireUser } from "@/lib/auth";
import { getOwnLineSettings } from "@/actions/notification-settings-actions";

export default async function ProfilePage() {
  const user = await requireUser();
  const lineSettings = await getOwnLineSettings();
  if (!lineSettings.ok) {
    return <main className="mx-auto max-w-4xl px-4 py-10 text-apple-red">{lineSettings.message}</main>;
  }
  return <ProfileSettings user={user} lineSettings={lineSettings.data} />;
}
