import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ExternalLink,
  FileText,
  Mail,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import type { HistoryRow } from "@/server/functions/get-history";
import { deleteHistoryItem, getDocumentDownload } from "@/server/functions/get-history";
import { AppliedToggle } from "@/components/features/applied-toggle";

interface HistoryTableProps {
  data: HistoryRow[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  onAppliedChange?: (id: number, applied: boolean) => void;
}

const columnHelper = createColumnHelper<HistoryRow>();

async function triggerDownload(r2Key: string, fileName: string) {
  const result = await getDocumentDownload({ data: { r2Key } });
  const blob = new Blob([new Uint8Array(result.data)], { type: result.contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function getScoreVariant(score: number) {
  if (score >= 80) return "success" as const;
  if (score >= 60) return "warning" as const;
  return "destructive" as const;
}

export function HistoryTable({
  data,
  total,
  page,
  onPageChange,
  pageSize,
  onAppliedChange,
}: HistoryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();

  async function handleDelete(row: HistoryRow) {
    const confirmed = window.confirm(
      `Delete analysis for "${row.jobTitle}" at "${row.company}"? This will also delete generated documents and cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(row.id);
    try {
      await deleteHistoryItem({ data: { id: row.id } });
      await router.invalidate();
    } catch (error) {
      console.error("Failed to delete history item:", error);
      window.alert(error instanceof Error ? error.message : "Failed to delete item");
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo(
    () => [
      columnHelper.accessor("createdAt", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: (info) => {
          const date = info.getValue();
          return date ? new Date(date).toLocaleDateString() : "—";
        },
      }),
      columnHelper.accessor("jobTitle", {
        header: "Job Title",
        cell: (info) => {
          const row = info.row.original;
          return (
            <Link
              to="/analyze/$id"
              params={{ id: String(row.id) }}
              className="font-medium text-[var(--lagoon)] hover:underline"
            >
              {info.getValue()}
            </Link>
          );
        },
      }),
      columnHelper.accessor("company", {
        header: "Company",
      }),
      columnHelper.accessor("matchScore", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Score
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        ),
        cell: (info) => {
          const score = info.getValue();
          return <Badge variant={getScoreVariant(score)}>{score}/100</Badge>;
        },
      }),
      columnHelper.accessor("jobUrl", {
        header: "JD",
        cell: (info) => (
          <a
            href={info.getValue()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[var(--lagoon)] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        ),
      }),
      columnHelper.accessor("documents", {
        header: "Docs",
        cell: (info) => {
          const docs = info.getValue();
          const resume = docs.find((d) => d.docType === "resume");
          const coverLetter = docs.find((d) => d.docType === "cover_letter");
          return (
            <div className="flex gap-1.5">
              {resume ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Download Resume"
                  onClick={() => triggerDownload(resume.r2Key, resume.fileName)}
                >
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {coverLetter ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Download Cover Letter"
                  onClick={() => triggerDownload(coverLetter.r2Key, coverLetter.fileName)}
                >
                  <Mail className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {!resume && !coverLetter && (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          );
        },
        enableSorting: false,
      }),
      columnHelper.display({
        id: "applied",
        header: "Applied",
        cell: ({ row }) => (
          <AppliedToggle
            analysisId={row.original.id}
            initialApplied={row.original.applied}
          />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link to="/analyze/$id" params={{ id: String(row.original.id) }} title="View Analysis">
                <Eye className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              title="Delete analysis"
              onClick={() => handleDelete(row.original)}
              disabled={deletingId === row.original.id}
            >
              {deletingId === row.original.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        ),
      }),
    ],
    [deletingId],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row.id),
  });

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="rounded-xl border border-[var(--line)] overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No analyses yet. Start by analyzing a job posting.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-muted-foreground">
          {data.length} of {total}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
