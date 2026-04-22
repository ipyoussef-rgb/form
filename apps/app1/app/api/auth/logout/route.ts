import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.cookies.set("app1_session", "", { path: "/", expires: new Date(0) });
  return res;
}
