import { createServerFn } from "@tanstack/react-start";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createSession, deleteSession, extractSessionToken } from "@/lib/session";
import { setCookie, getRequest } from "@tanstack/react-start/server";

const SESSION_COOKIE = "job-analyzer-session";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Login: validates credentials, creates a session, sets cookie via response header.
 */
export const loginUser = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string }) => data)
  .handler(async ({ data }) => {
    const env = getCloudflareEnv();
    if (!env.DB || !env.KV) throw new Error("Service unavailable");

    const db = getDb(env.DB);
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!dbUser) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(data.password, dbUser.passwordHash);
    if (!valid) throw new Error("Invalid credentials");

    const token = await createSession(dbUser.id, env);

    // Set session cookie via HTTP response header (HttpOnly, Secure)
    setCookie(SESSION_COOKIE, token, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax" as const,
      maxAge: SESSION_TTL,
    });

    return {
      user: { id: dbUser.id, email: dbUser.email, role: dbUser.role },
    };
  });

/**
 * Logout: deletes the session from KV and clears the cookie via response header.
 */
export const logoutUser = createServerFn({ method: "POST" })
  .handler(async () => {
    const env = getCloudflareEnv();

    const request = getRequest();
    const token = extractSessionToken(request);
    if (token && env.KV) await deleteSession(token, env);

    // Clear session cookie via HTTP response header
    setCookie(SESSION_COOKIE, "", {
      path: "/",
      httpOnly: true,
      secure: true,
      maxAge: 0,
    });

    return { success: true };
  });
