import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __pdfStore: Map<string, Uint8Array> | undefined;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bytes = globalThis.__pdfStore?.get(id);
  if (!bytes) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(bytes, { headers: { "content-type": "application/pdf" } });
}
