// ถาม LINE ว่า access token นี้เป็นของใคร (ปลอมไม่ได้ เพราะ LINE เป็นคนตอบ)
export async function getLineUserId(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const profile = (await res.json()) as { userId?: string };
    return profile.userId ?? null;
  } catch {
    return null;
  }
}