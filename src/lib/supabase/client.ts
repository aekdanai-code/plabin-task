import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("your-project") || key.includes("your-anon")) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  return createBrowserClient(url, key);
}
