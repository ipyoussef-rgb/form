import { NextResponse } from "next/server";
import { readEnv } from "@repo/config";
import { TelnyxFaxService } from "@repo/fax";
import { repositories } from "@repo/shared";
import { readSession } from "../../../../lib/auth";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { to, documentId, transactionId } = await req.json() as { to: string; documentId: string; transactionId: string };
  const payment = repositories.payments.get(transactionId);
  if (!payment || payment.status !== "confirmed") return NextResponse.json({ error: "payment not confirmed" }, { status: 409 });
  const doc = repositories.documents.get(documentId);
  if (!doc) return NextResponse.json({ error: "document not found" }, { status: 404 });
  const env = readEnv();
  const fax = new TelnyxFaxService();
  const clientState = Buffer.from(`${documentId}:${transactionId}`).toString("base64");
  const webhookUrl = `${env.APP2_BASE_URL}/api/fax/webhook`;
  const mediaUrl = doc.fileUrl.startsWith("http") ? doc.fileUrl : `${env.TELNYX_PUBLIC_BASE_URL}${doc.fileUrl}`;
  const sent = await fax.send({ to, media_url: mediaUrl, connection_id: env.TELNYX_FAX_CONNECTION_ID, from: env.TELNYX_FAX_FROM_NUMBER, client_state: clientState, webhook_url: webhookUrl });
  return NextResponse.json(sent);
}
