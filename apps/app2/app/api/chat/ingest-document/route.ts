import { NextResponse } from "next/server";
import { readEnv } from "@repo/config";
import { documentMetadataSchema, repositories } from "@repo/shared";
import { KobilChatService } from "@repo/kobil";

export async function POST(req: Request) {
  const env = readEnv();
  if (req.headers.get("x-shared-secret") !== env.APP2_INGEST_SHARED_SECRET) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const payload = documentMetadataSchema.parse(await req.json());
  repositories.documents.save({ ...payload, sourceApp: "app1" });
  const chat = new KobilChatService();
  await chat.ingest(payload.ownerSub, payload);
  return NextResponse.json({ ok: true });
}
