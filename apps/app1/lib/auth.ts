import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";

const getKey = () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return new TextEncoder().encode(secret);
};

export const createPkce = () => {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
};

export async function createSession(payload: Record<string, unknown>) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(getKey());
}

export async function readSession() {
  const store = await cookies();
  const token = store.get("app1_session")?.value;
  if (!token) return null;
  try {
    return (await jwtVerify(token, getKey())).payload;
  } catch {
    return null;
  }
}
