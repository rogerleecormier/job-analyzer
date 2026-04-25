// Add getSessionUser helper for extracting user from session
import { extractSessionToken } from '@/lib/session';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';

export interface SessionUser {
  id: number;
  email: string;
  role: string;
}

export async function getSessionUser(
  request: Request,
  env: Partial<CloudflareEnv>,
): Promise<SessionUser | null> {
  if (!env.DB || !env.KV) return null;
  const token = extractSessionToken(request);
  if (!token) return null;
  const raw = await env.KV.get(`session:${token}`);
  if (!raw) return null;
  const { userId } = JSON.parse(raw);
  const db = getDb(env.DB);
  const dbUser = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!dbUser) return null;
  return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
}
/**
 * Cloudflare Worker environment bindings.
 * Typed via declaration merging with Cloudflare.Env in worker-configuration.d.ts.
 */
import { env as cfEnv } from "cloudflare:workers";

export interface CloudflareEnv {
  DB: D1Database;
  R2: R2Bucket;
  KV: KVNamespace;
  AI: Ai;
  BROWSER: Fetcher;
  currentUser?: SessionUser;
}

/**
 * Access Cloudflare bindings from a TanStack Start server function.
 * In production, returns real bindings from the Workers runtime.
 * In dev, the vite.config.ts alias points this import to a stub returning {}.
 */
export function getCloudflareEnv(): Partial<CloudflareEnv> {
  return cfEnv as unknown as Partial<CloudflareEnv>;
}
