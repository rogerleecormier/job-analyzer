/**
 * Custom Worker entry that combines TanStack Start's fetch handler
 * with the Cron Trigger scheduled handler.
 *
 * wrangler.jsonc points `main` to this file instead of
 * `@tanstack/react-start/server-entry`.
 */
// Polyfill AbortController/AbortSignal for Cloudflare Workers if missing
if (typeof globalThis.AbortController === "undefined") {
  // @ts-ignore
  globalThis.AbortController = class {
    constructor() {
      this.signal = {};
    }
    abort() {}
  };
  // @ts-ignore
  globalThis.AbortSignal = function () {};
}

import {
  createStartHandler,
  defaultStreamHandler,
} from "@tanstack/react-start/server";
import { createServerEntry } from "@tanstack/react-start/server-entry";
import { aggregateAnalytics } from "./cron/aggregate-analytics";
import type { CloudflareEnv } from "@/lib/cloudflare";

import { getSessionUser } from '@/lib/cloudflare';

const startFetch = createStartHandler(defaultStreamHandler);

const PUBLIC_PATHS = ['/', '/about', '/login'];



async function persistLog(env, level, message, meta = {}) {
  if (!env.LOG_ENDPOINT) return;
  try {
    await fetch(env.LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        meta,
      }),
    });
  } catch (e) {
    // Ignore logging errors
  }
}

function ensureSignal(request: Request): Request {
  if (request.signal !== undefined) return request;
  const { signal } = new AbortController();
  return new Request(request, { signal });
}

const handleFetch = async (request: Request, env: CloudflareEnv, _ctx: ExecutionContext) => {
  request = ensureSignal(request);
  const url = new URL(request.url);
  let user = null;
  try {
    user = await getSessionUser(request, env);
    if (user) {
      env.currentUser = user;
    }
  } catch (err) {
    const warn = `[Auth] Session parse failed for ${url.pathname}: ${String(err)}`;
    console.warn(warn);
    persistLog(env, 'warn', warn, { path: url.pathname });
  }

  const isPublic =
    PUBLIC_PATHS.includes(url.pathname) ||
    url.pathname.startsWith('/_serverFn/') ||
    url.pathname.startsWith('/public') ||
    url.pathname.startsWith('/assets') ||
    url.pathname.startsWith('/favicon') ||
    url.pathname.startsWith('/manifest') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg');

  // Log every request (console and persistent)
  const reqMsg = `[Request] ${request.method} ${url.pathname}`;
  console.log(reqMsg);
  persistLog(env, 'info', reqMsg, { method: request.method, path: url.pathname });

  if (isPublic) {
    return startFetch(request);
  }

  try {
    if (!user) {
      const warnMsg = `[Auth] Unauthenticated access to ${url.pathname}`;
      console.warn(warnMsg);
      persistLog(env, 'warn', warnMsg, { path: url.pathname });
      // Redirect to home if trying to access /analyze unauthenticated
      if (url.pathname === '/analyze') {
        return Response.redirect(`${url.origin}/`, 302);
      }
      return Response.redirect(`${url.origin}/login`, 302);
    }
    const authMsg = `[Auth] User ${user.email} (${user.role}) accessed ${url.pathname}`;
    console.log(authMsg);
    persistLog(env, 'info', authMsg, { user: user.email, role: user.role, path: url.pathname });
    return await startFetch(request);
  } catch (err) {
    const errMsg = `[Error] ${url.pathname}: ${err && err.message ? err.message : err}`;
    console.error(errMsg);
    persistLog(env, 'error', errMsg, { error: String(err), path: url.pathname });
    return new Response('Internal error', { status: 500 });
  }
};


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entry = createServerEntry({ fetch: handleFetch as any });

export default {
  fetch: entry.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: CloudflareEnv,
    _ctx: ExecutionContext,
  ) {
    await aggregateAnalytics(env);
  },
};
