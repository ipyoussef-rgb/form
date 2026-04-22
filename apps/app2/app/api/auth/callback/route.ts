export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OidcIdentityService } from "@repo/kobil";
import { readEnv } from "@repo/config";
import { createSession } from "../../../../lib/auth";

export async function GET(req: Request) {
  const env = readEnv();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const c = await cookies();
  const storedState = c.get("app2_state")?.value;
  const nonce = c.get("app2_nonce")?.value ?? "";
  if (!code || !state || state !== storedState) return NextResponse.json({ error: "invalid callback" }, { status: 400 });
  const identity = new OidcIdentityService();
  const token = await identity.exchangeCode({ app: "app2", code, codeVerifier: c.get("app2_verifier")?.value ?? "", redirectUri: `${env.APP2_BASE_URL}/api/auth/callback` });
  if (token.id_token && nonce) {
    await identity.validateIdToken({ app: "app2", idToken: token.id_token, nonce });
  }
  const profile = await identity.userinfo(token.access_token);
  const session = await createSession({ sub: profile.sub, profile, accessToken: token.access_token });
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("app2_session", session, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  res.cookies.delete("app2_state");
  res.cookies.delete("app2_verifier");
  res.cookies.delete("app2_nonce");
  return res;
}
