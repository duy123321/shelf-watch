import { STATUS_LABELS, type ReadStatus } from "@shelf-watch/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * A reading-status pill with a fixed colour per status:
 *   grey  = To read (TBR)
 *   blue  = Reading
 *   green = Finished
 *   red   = Did not finish (DNF)
 *
 * Wraps the shadcn <Badge> for shape/typography and overrides only the colour.
 * The built-in variants top out at one accent (`secondary`) plus `destructive`,
 * which isn't a four-way scale, so the palette classes live here. `cn`
 * (tailwind-merge) lets the `bg-*`/`text-*` below win over the default variant.
 */
const STATUS_STYLES: Record<ReadStatus, string> = {
  TBR: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  READING: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  FINISHED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  DNF: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export default function StatusBadge({
  status,
  className,
}: {
  status: ReadStatus;
  className?: string;
}) {
  return (
    <Badge className={cn(STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
