import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const TOKEN_COOKIE = "auth_token";

export type TokenPayload = {
  sub: string;
  email: string;
  role: "admin" | "member";
};

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: TokenPayload) {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || typeof payload.email !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as "admin" | "member",
    };
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request | undefined) {
  const header = request?.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7) || null;
}

export { TOKEN_COOKIE };
