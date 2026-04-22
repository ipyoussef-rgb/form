import { NextResponse } from "next/server";
import { KobilPayService } from "@repo/kobil";
import { readSession } from "../../../../lib/auth";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { transactionId } = await req.json() as { transactionId?: string };
  if (!transactionId) return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
  const pay = new KobilPayService();
  const status = await pay.refreshTransactionStatus(transactionId);
  return NextResponse.json(status);
}
