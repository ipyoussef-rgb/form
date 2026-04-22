import { NextResponse } from "next/server";
import { KobilPayService } from "@repo/kobil";
import { readSession } from "../../../../lib/auth";

export async function POST(req: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pay = new KobilPayService();
  const result = await pay.createTransaction(await req.json());
  return NextResponse.json(result);
}
