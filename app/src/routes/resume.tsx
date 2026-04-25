import { createFileRoute, redirect } from "@tanstack/react-router";
import { ResumeManager } from "@/components/features/resume-manager";
import { getResume } from "@/server/functions/manage-resume";
import { Skeleton } from "@/components/ui/skeleton";
import { FileUser } from "lucide-react";

export const Route = createFileRoute("/resume")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  component: ResumePage,
  loader: async () => {
    return getResume();
  },
  pendingComponent: ResumeLoading,
});

function ResumePage() {
  const data = Route.useLoaderData();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--lagoon)]/15">
          <FileUser className="h-5 w-5 text-[var(--lagoon)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Upload or edit your master resume. AI uses this for all analyses and document generation.
          </p>
        </div>
      </div>
      <ResumeManager initial={data} />
    </div>
  );
}

function ResumeLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-[600px] w-full rounded-xl" />
    </div>
  );
}
