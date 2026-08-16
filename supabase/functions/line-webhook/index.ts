import { createClient } from "npm:@supabase/supabase-js@2.110.5";

function secretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, string>;
  const key = Object.values(keys)[0];
  if (!key) throw new Error("SUPABASE_SECRET_KEY_MISSING");
  return key;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(body: string, signature: string, channelSecret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(channelSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return expected === signature;
}

Deno.serve(async (request) => {
  const body = await request.text();
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), { auth: { persistSession: false } });
  const [{ data: channelSecret }, { data: accessToken }] = await Promise.all([
    supabase.rpc("get_notification_secret", { secret_name: "notification_line_channel_secret" }),
    supabase.rpc("get_notification_secret", { secret_name: "notification_line_access_token" })
  ]);
  if (!channelSecret || !await validSignature(body, request.headers.get("x-line-signature") || "", channelSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(body) as { events?: Array<Record<string, unknown>> };
  for (const event of payload.events || []) {
    const source = event.source as { type?: string; userId?: string } | undefined;
    const userId = source?.userId;
    if (!userId) continue;

    if (event.type === "unfollow") {
      await supabase.from("user_notification_channels").update({ line_link_status: "BLOCKED", line_blocked_at: new Date().toISOString() }).eq("line_user_id", userId);
      continue;
    }

    const message = event.message as { type?: string; text?: string } | undefined;
    const match = message?.type === "text" ? message.text?.trim().toUpperCase().match(/^LINK\s+([0-9A-F]{8})$/) : null;
    let replyText = "เข้าสู่ Plabin Task > โปรไฟล์ > สร้างรหัสเชื่อม LINE แล้วส่งข้อความ LINK ตามด้วยรหัส 8 ตัว";
    if (match) {
      const { error } = await supabase.rpc("complete_line_link", { link_token_hash: await sha256(match[1]), target_line_user_id: userId });
      replyText = error ? "รหัสไม่ถูกต้องหรือหมดอายุ กรุณาสร้างรหัสใหม่ใน Plabin Task" : "เชื่อม LINE กับ Plabin Task สำเร็จแล้ว";
    }

    const replyToken = event.replyToken as string | undefined;
    if (replyToken && accessToken) {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ replyToken, messages: [{ type: "text", text: replyText }] })
      });
    }
  }
  return Response.json({ ok: true });
});
