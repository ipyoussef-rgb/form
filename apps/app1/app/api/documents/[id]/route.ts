import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __pdfStore: Map<string, Uint8Array> | undefined;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bytes = globalThis.__pdfStore?.get(id);
  if (!bytes) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Ensure a concrete ArrayBuffer-backed typed array for BodyInit compatibility in Next.js build.
  const safeBytes = new Uint8Array(bytes.byteLength);
  safeBytes.set(bytes);

  return new NextResponse(safeBytes, { headers: { "content-type": "application/pdf" } });
}
