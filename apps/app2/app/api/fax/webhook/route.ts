import { NextResponse } from "next/server";
import { TelnyxFaxService } from "@repo/fax";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("telnyx-signature-ed25519") ?? "";
  const timestamp = req.headers.get("telnyx-timestamp") ?? "";
  const service = new TelnyxFaxService();
  if (!service.verifyWebhook(raw, signature, timestamp)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const result = await service.handleWebhook(JSON.parse(raw));
  return NextResponse.json(result);
}
