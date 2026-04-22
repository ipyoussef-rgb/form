import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { readEnv } from "@repo/config";

const env = readEnv();
const key = new TextEncoder().encode(env.AUTH_SECRET);

export const createPkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};

export async function createSession(payload: Record<string, unknown>) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(key);
}

export async function readSession() {
  const store = await cookies();
  const token = store.get("app2_session")?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, key)).payload;
  } catch {
    return null;
  }
}
