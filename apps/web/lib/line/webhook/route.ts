import { after, NextResponse } from "next/server";
import { replyMessage, type LineWebhookBody } from "@/lib/line/client";
import { buildReply } from "@/lib/line/handler";
import { verifyLineSignature } from "@/lib/line/signature";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelSecret || !accessToken) {
    console.error("LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN are not set");
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: LineWebhookBody;
  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  after(async () => {
    const results = await Promise.allSettled(
      events.map(async (event) => {
        const messages = await buildReply(event);
        if (messages && event.replyToken) {
          await replyMessage(event.replyToken, messages, accessToken);
        }
      }),
    );
    for (const r of results) {
      if (r.status === "rejected") console.error("LINE event failed:", r.reason);
    }
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ status: "line webhook ready" });
}