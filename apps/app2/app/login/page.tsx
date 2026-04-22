import { redirect } from "next/navigation";
import { OidcIdentityService } from "@repo/kobil";
import { createPkce } from "../../lib/auth";
import { cookies } from "next/headers";

export default async function Login() {
  const identity = new OidcIdentityService();
  const { verifier, challenge } = createPkce();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const c = await cookies();
  c.set("app2_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  c.set("app2_verifier", verifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  c.set("app2_nonce", nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  const url = await identity.buildAuthorizeUrl({ app: "app2", state, nonce, codeChallenge: challenge });
  redirect(url as never);
}
