// Session management for job-analyzer (Cloudflare Workers)
// Uses KV for session storage, 7-day expiry
import { nanoid } from 'nanoid';

const SESSION_COOKIE = 'job-analyzer-session';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

export async function createSession(userId, env) {
  const token = nanoid(32);
  const session = { userId, createdAt: new Date().toISOString() };
  await env.KV.put(`session:${token}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return token;
}

export async function getSession(token, env) {
  if (!token) return null;
  const raw = await env.KV.get(`session:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function deleteSession(token, env) {
  if (!token) return;
  await env.KV.delete(`session:${token}`);
}

export function getSessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; Max-Age=0;`;
}

export function extractSessionToken(request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/job-analyzer-session=([^;]+)/);
  return match ? match[1] : null;
}
