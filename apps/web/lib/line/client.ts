const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const PUSH_URL = "https://api.line.me/v2/bot/message/push";

export type QuickReplyItem = {
  type: "action";
  action: { type: "postback"; label: string; data: string; displayText?: string };
};

export type LineTextMessage = {
  type: "text";
  text: string;
  quickReply?: { items: QuickReplyItem[] };
};
export type LineMessage = LineTextMessage;

export type LineEvent = {
  type: string;
  replyToken?: string;
  source?: { type: string; userId?: string };
  message?: { type: string; id: string; text?: string };
  postback?: { data: string };
};

export type LineWebhookBody = {
  destination?: string;
  events: LineEvent[];
};

export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
  accessToken: string,
): Promise<void> {
  const res = await fetch(REPLY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    throw new Error(`LINE reply failed: ${res.status} ${await res.text()}`);
  }
}
// push ข้อความเเจ้งว่าถึงคิวเเล้ว
export async function pushMessage(to: string, messages: LineMessage[], accessToken: string): Promise<void> {
  const res = await fetch(PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ to, messages }),
  });
  if (!res.ok) {
    throw new Error(`LINE push failed: ${res.status} ${await res.text()}`);
  }
}