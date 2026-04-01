import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const secret = process.env.CS_PROXY_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("CS_PROXY_SECRET or BETTER_AUTH_SECRET must be set");
  return new TextEncoder().encode(secret);
}

export async function generateProxyToken(
  userId: string,
  svcName: string,
): Promise<string> {
  return new SignJWT({ sub: userId, svc: svcName })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecret());
}

export async function verifyProxyToken(
  token: string,
): Promise<{ userId: string; svcName: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string" || typeof payload.svc !== "string") {
      return null;
    }
    return { userId: payload.sub, svcName: payload.svc };
  } catch {
    return null;
  }
}
