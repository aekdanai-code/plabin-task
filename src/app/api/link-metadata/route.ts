import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveLinkTitle } from "@/lib/link-metadata";

export const runtime = "nodejs";

const getCachedTitle = unstable_cache(
  async (url: string) => {
    try {
      return await resolveLinkTitle(url);
    } catch {
      return null;
    }
  },
  ["link-metadata-v1"],
  { revalidate: 86_400 }
);

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rawUrl = new URL(request.url).searchParams.get("url")?.trim() ?? "";
  if (!rawUrl || rawUrl.length > 2048) {
    return NextResponse.json({ message: "Invalid URL" }, { status: 400 });
  }

  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Invalid protocol");
  } catch {
    return NextResponse.json({ message: "Invalid URL" }, { status: 400 });
  }

  const title = await getCachedTitle(rawUrl);
  return NextResponse.json(
    { url: rawUrl, title: title || rawUrl },
    { headers: { "Cache-Control": "private, max-age=3600" } }
  );
}
