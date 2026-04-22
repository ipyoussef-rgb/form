import { NextResponse } from "next/server";
import { repositories } from "@repo/shared";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = repositories.documents.get(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.redirect(new URL(doc.fileUrl, process.env.APP1_BASE_URL));
}
