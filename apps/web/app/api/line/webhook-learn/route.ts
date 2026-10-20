import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function GET() {
  return NextResponse.json({ status: "hello from my webhook" });
}

export async function POST(req: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "no secret configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "base64");

  const valid =
    received.length === expected.length && timingSafeEqual(received, expected);

  if (!valid) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  for (const event of body.events) {
    if (event.type === "message" && event.message.type === "text") {
      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: `คุณพิมพ์ว่า: ${event.message.text}` }],
        }),
      });
    }
  }

  return NextResponse.json({ ok: true });
}