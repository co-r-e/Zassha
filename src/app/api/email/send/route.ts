import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const RESEND_API_KEY = process.env.RESEND_API_KEY as string;
    if (!RESEND_API_KEY) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
    const { to, subject, text } = (await req.json()) as { to: string; subject: string; text: string };
    if (!to || !subject || !text) return NextResponse.json({ error: "invalid params" }, { status: 400 });
    const resend = new Resend(RESEND_API_KEY);
    const r = await resend.emails.send({ from: "ZASSHA <noreply@zassha.app>", to, subject, text });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "internal error" }, { status: 500 });
  }
}


