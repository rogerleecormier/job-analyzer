import { createServerFn } from "@tanstack/react-start";
import { getCloudflareEnv } from "@/lib/cloudflare";
import { extractSessionToken } from "@/lib/session";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRequest } from "@tanstack/react-start/server";

export interface CurrentUser {
  id: number;
  email: string;
  role: string;
}

/**
 * Get the currently logged-in user from the session cookie.
 * Returns null if not authenticated.
 */
export const getCurrentUser = createServerFn({ method: "GET" })
  .handler(async (): Promise<CurrentUser | null> => {
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
      console.error("getCurrentUser error:", error);
      return null;
    }
  });
