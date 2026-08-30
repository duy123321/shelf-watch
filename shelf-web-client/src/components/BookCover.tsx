import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A book jacket, with a typographic fallback when there is no art.
 *
 * `ShelfBook.cover` is nullable by contract, and a URL that exists can still
 * fail to load, so both cases collapse to the same placeholder rather than
 * leaving a broken-image icon on the shelf.
 */
export default function BookCover({
  src,
  title,
  className,
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Reset on src change, or a book that failed once keeps its placeholder
  // when the dialog is reused for a different book.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted p-3 text-center",
          className,
        )}
      >
        <span className="line-clamp-4 text-xs font-medium text-muted-foreground">
          {title}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Cover of ${title}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("bg-muted object-cover", className)}
    />
  );
}
