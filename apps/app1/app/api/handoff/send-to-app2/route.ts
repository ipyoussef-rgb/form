import { NextResponse } from "next/server";
import { readEnv } from "@repo/config";
import { repositories } from "@repo/shared";
import { readSession } from "../../../../lib/auth";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { documentId } = await req.json() as { documentId: string };
  const doc = repositories.documents.get(documentId);
  if (!doc) return NextResponse.json({ error: "missing document" }, { status: 404 });
  const env = readEnv();
  const res = await fetch(`${env.APP2_BASE_URL}/api/chat/ingest-document`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-shared-secret": env.APP2_INGEST_SHARED_SECRET },
    body: JSON.stringify({ ...doc, ownerSub: session.sub })
  });
  if (!res.ok) return NextResponse.json({ error: "handoff failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
