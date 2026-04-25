/**
 * Stub for the `cloudflare:workers` module in local development.
 * In production this is provided by the Cloudflare Workers runtime.
 * Here it returns an empty object so server functions can detect missing bindings.
 */
export const env: Record<string, unknown> = {};
