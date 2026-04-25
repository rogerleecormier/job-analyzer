import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "@/server/functions/auth";

export const Route = createFileRoute("/api/me")({
  loader: async ({ request, context }) => {
    const user = await getCurrentUser({ env: context.env, request });
    return user || null;
  },
});
