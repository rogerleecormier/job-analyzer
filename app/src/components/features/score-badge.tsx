import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

function getScoreConfig(score: number) {
  if (score >= 80) return { variant: "success" as const, label: "Strong Match" };
  if (score >= 60) return { variant: "warning" as const, label: "Moderate Match" };
  return { variant: "destructive" as const, label: "Weak Match" };
}

export function ScoreBadge({ score, size = "md" }: ScoreBadgeProps) {
  const config = getScoreConfig(score);

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "font-mono",
        size === "sm" && "text-xs px-2 py-0.5",
        size === "md" && "text-sm px-3 py-1",
        size === "lg" && "text-lg px-4 py-2",
      )}
    >
      {score}/100
    </Badge>
  );
}
