import { cn } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";

interface PursueVerdictProps {
  pursue: boolean;
  justification: string;
}

export function PursueVerdict({ pursue, justification }: PursueVerdictProps) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4",
        pursue
          ? "border-green-500/30 bg-green-500/5"
          : "border-red-500/30 bg-red-500/5",
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {pursue ? (
          <CheckCircle className="h-6 w-6 text-green-600" />
        ) : (
          <XCircle className="h-6 w-6 text-red-600" />
        )}
        <span
          className={cn(
            "text-lg font-bold",
            pursue ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400",
          )}
        >
          {pursue ? "PURSUE" : "DO NOT PURSUE"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{justification}</p>
    </div>
  );
}
