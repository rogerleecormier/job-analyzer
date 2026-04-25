import { createServerFn } from "@tanstack/react-start";
import { getCloudflareEnv } from "@/lib/cloudflare";

/**
 * Clean a URL by stripping tracking parameters that don't affect content.
 * LinkedIn URLs carry huge tracking params that can exceed KV key limits.
 */
function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    // For LinkedIn job URLs, only keep currentJobId — everything else is tracking
    if (url.hostname.includes("linkedin.com") && url.pathname.includes("/jobs")) {
      const jobId = url.searchParams.get("currentJobId");
      if (jobId) {
        return `https://www.linkedin.com/jobs/view/${jobId}/`;
      }
    }
    // For other URLs, strip common tracking params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "trackingId", "refId", "eBP"];
    for (const p of trackingParams) {
      url.searchParams.delete(p);
    }
    return url.toString();
  } catch {
    return raw;
  }
}

/**
 * Generate a KV-safe cache key. KV keys must be ≤ 512 bytes.
 * Uses the cleaned URL directly if short enough, otherwise hashes it.
 */
async function makeCacheKey(url: string): Promise<string> {
  const prefix = "scrape:";
  const cleaned = cleanUrl(url);
  if (prefix.length + cleaned.length <= 512) {
    return `${prefix}${cleaned}`;
  }
  // Hash the URL with Web Crypto (available in Workers)
  const data = new TextEncoder().encode(cleaned);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}sha256:${hex}`;
}

/**
 * Scrape a job description from a URL using Cloudflare Browser Rendering.
 * Results are cached in KV with a 7-day TTL.
 */
export const scrapeJob = createServerFn({ method: "POST" })
  .inputValidator((data: { url: string }) => {
    if (!data.url || !URL.canParse(data.url)) {
      throw new Error("A valid URL is required");
    }
    return data;
  })
  .handler(async ({ data }) => {
    try {
      const env = getCloudflareEnv();
      if (!env.BROWSER || !env.KV) {
        throw new Error("Browser rendering not available in development mode. Deploy to Cloudflare Workers to use this feature.");
      }

      // Create a cache key from the cleaned URL
      const cacheKey = await makeCacheKey(data.url);
      const navigateUrl = cleanUrl(data.url);

      // Check KV cache first
      const cached = await env.KV.get(cacheKey);
      if (cached) {
        return { text: cached, fromCache: true };
      }

      // Use Browser Rendering API via Puppeteer
      const puppeteer = await import("@cloudflare/puppeteer");
      const browser = await puppeteer.default.launch(env.BROWSER);
      const page = await browser.newPage();

      try {
        await page.goto(navigateUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
        // Give dynamic content a moment to render
        await new Promise((r) => setTimeout(r, 3000));

        // Extract text content from the page body
        const text = await page.evaluate(() => {
          // Remove script/style elements
          const scripts = document.querySelectorAll("script, style, nav, footer, header");
          scripts.forEach((el) => el.remove());
          return document.body?.innerText?.trim() ?? "";
        });

        if (!text) {
          throw new Error("No text content extracted from the page");
        }

        // Cache in KV for 7 days
        await env.KV.put(cacheKey, text, { expirationTtl: 7 * 24 * 60 * 60 });

        return { text, fromCache: false };
      } finally {
        await browser.close();
      }
    } catch (error) {
      console.error("scrapeJob error:", error);
      throw error;
    }
  });
