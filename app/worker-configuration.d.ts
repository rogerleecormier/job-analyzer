/**
 * Extend Cloudflare.Env to type `import { env } from "cloudflare:workers"`.
 * These bindings are configured in wrangler.jsonc.
 */
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    R2: R2Bucket;
    KV: KVNamespace;
    AI: Ai;
    BROWSER: Fetcher;
    AI_GATEWAY_ENDPOINT: string;
    ANTHROPIC_MODEL: string;
    ANTHROPIC_API_KEY: string;
  }
}
