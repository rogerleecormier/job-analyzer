// Auth server functions: login, logout, getCurrentUser
import { eq } from 'drizzle-orm';
import { users } from '@/db/schema';
import { createSession, deleteSession, extractSessionToken, getSessionCookie, clearSessionCookie } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function login({ data, env, request }) {
  const { email, password } = data;
  const dbUser = await env.DB.select().from(users).where(eq(users.email, email)).get();
  if (!dbUser) throw new Error('Invalid credentials');
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) throw new Error('Invalid credentials');
  const token = await createSession(dbUser.id, env);
  return {
    setCookie: getSessionCookie(token),
    user: { id: dbUser.id, email: dbUser.email, role: dbUser.role },
  };
}

export async function logout({ env, request }) {
  const token = extractSessionToken(request);
  if (token) await deleteSession(token, env);
  return { setCookie: clearSessionCookie() };
}

export async function getCurrentUser({ env, request }) {
  const token = extractSessionToken(request);
  if (!token) return null;
  const session = await env.KV.get(`session:${token}`);
  if (!session) return null;
  const { userId } = JSON.parse(session);
  const dbUser = await env.DB.select().from(users).where(eq(users.id, userId)).get();
  if (!dbUser) return null;
  return { id: dbUser.id, email: dbUser.email, role: dbUser.role };
}
