import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
  plugins: [
    // Only use Cloudflare plugin in production builds
    ...(!isDev
      ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
      : []),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: isDev
      ? {
          // Stub out cloudflare:workers in dev so the import doesn't crash.
          // In production the real Workers runtime provides this module.
          "cloudflare:workers": path.resolve(
            __dirname,
            "src/lib/cloudflare-workers-stub.ts",
          ),
        }
      : {},
  },
});
