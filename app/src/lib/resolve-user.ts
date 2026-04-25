/**
 * Shared helper to resolve the current authenticated user from the session cookie.
 * This is used inside TanStack Start server functions where env.currentUser
 * is not available (since there's no worker-level auth middleware).
 */
import { getCloudflareEnv } from "@/lib/cloudflare";
import { extractSessionToken } from "@/lib/session";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRequest } from "@tanstack/react-start/server";

export interface SessionUser {
  id: number;
  email: string;
  role: string;
}

/**
 * Resolves the current user from the session cookie in the current request.
 * Call this from within a TanStack Start server function handler.
 * Returns null if not authenticated.
 */
export async function resolveSessionUser(): Promise<SessionUser | null> {
  try {
    const env = getCloudflareEnv();
    if (!env.DB || !env.KV) return null;

    const request = getRequest();
    const token = extractSessionToken(request);
    if (!token) return null;

    const raw = await env.KV.get(`session:${token}`);
    if (!raw) return null;

    const { userId } = JSON.parse(raw);
    const db = getDb(env.DB);
    const [dbUser] = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!dbUser) return null;
    return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
  } catch (error) {
    console.error("[resolveSessionUser] error:", error);
    return null;
  }
}
