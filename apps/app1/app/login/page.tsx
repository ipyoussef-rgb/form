import { redirect } from "next/navigation";
import { OidcIdentityService } from "@repo/kobil";
import { createPkce } from "../../lib/auth";
import { cookies } from "next/headers";

export default async function Login() {
  const identity = new OidcIdentityService();
  const { verifier, challenge } = createPkce();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("app1_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  cookieStore.set("app1_verifier", verifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  cookieStore.set("app1_nonce", nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  const url = await identity.buildAuthorizeUrl({ app: "app1", state, nonce, codeChallenge: challenge });
  redirect(url as never);
}
