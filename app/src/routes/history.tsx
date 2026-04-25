import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { HistoryTable } from "@/components/features/history-table";
import { getHistory } from "@/server/functions/get-history";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/history")({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/login" });
  },
  component: HistoryPage,
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number(search.page) || 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ deps }) => {
    return getHistory({ data: { page: deps.page, pageSize: PAGE_SIZE } });
  },
  pendingComponent: HistoryLoading,
});

function HistoryPage() {
  const { rows, total } = Route.useLoaderData();
  const { page } = Route.useSearch();
  const navigate = useNavigate();

  function handlePageChange(newPage: number) {
    navigate({ to: "/history", search: { page: newPage } });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--lagoon)]/15">
          <History className="h-5 w-5 text-[var(--lagoon)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">History</h1>
          <p className="text-sm text-[var(--sea-ink-soft)]">Browse analyses and download documents.</p>
        </div>
      </div>
      <HistoryTable
        data={rows}
        total={total}
        page={page}
        onPageChange={handlePageChange}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}

function HistoryLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}
