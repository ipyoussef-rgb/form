import { NextResponse } from "next/server";
import { generateVollmachtPdf } from "@repo/pdf";
import { readEnv } from "@repo/config";
import { repositories, vollmachtInputSchema } from "@repo/shared";
import { readSession } from "../../../../lib/auth";

declare global {
  // eslint-disable-next-line no-var
  var __pdfStore: Map<string, Uint8Array> | undefined;
}

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const payload = vollmachtInputSchema.parse(await req.json());
  const bytes = await generateVollmachtPdf(payload);
  const id = crypto.randomUUID();
  const filename = `vollmacht-${payload.lastName}-${payload.firstName}-${new Date().toISOString().slice(0,10)}.pdf`;
  const env = readEnv();
  const fileUrl = `${env.APP1_BASE_URL}/api/documents/${id}`;
  repositories.documents.save({ id, filename, mimeType: "application/pdf", createdAt: new Date().toISOString(), fileUrl, sourceApp: "app1", ownerSub: String(session.sub), size: bytes.byteLength });
  globalThis.__pdfStore = globalThis.__pdfStore || new Map<string, Uint8Array>();
  globalThis.__pdfStore.set(id, bytes);
  return NextResponse.json({ document: repositories.documents.get(id) });
}
