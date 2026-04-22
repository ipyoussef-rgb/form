import { NextResponse } from "next/server";
import { KobilPayService } from "@repo/kobil";

export async function POST(req: Request) {
  const service = new KobilPayService();
  const result = await service.processCallback(await req.json());
  return NextResponse.json(result);
}
