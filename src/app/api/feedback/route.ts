import { NextRequest, NextResponse } from "next/server";

const SCREENSHOT_PREFIX = "data:image/png;base64,";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO_EMAIL;
  if (!apiKey || !to) {
    return NextResponse.json(
      { error: "Feedback isn't configured on this install." },
      { status: 500 }
    );
  }

  const attachments: { filename: string; content: string }[] = [];
  const screenshot = body?.screenshot;
  if (typeof screenshot === "string" && screenshot.startsWith(SCREENSHOT_PREFIX)) {
    attachments.push({
      filename: "screenshot.png",
      content: screenshot.slice(SCREENSHOT_PREFIX.length),
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Clean My Sh*t Feedback <onboarding@resend.dev>",
      to: [to],
      subject: "Clean My Sh*t feedback",
      text: message,
      attachments,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: `Send failed: ${detail}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
