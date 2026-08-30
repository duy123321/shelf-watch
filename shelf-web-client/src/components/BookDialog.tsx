import {
  READ_STATUSES,
  STATUS_LABELS,
  type ReadStatus,
  type ShelfBook,
} from "@shelf-watch/shared";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import BookCover from "./BookCover";
import StatusBadge from "./StatusBadge";

/**
 * PLACEHOLDER. There is no started-reading date in the schema — `UserRead`
 * has `createdAt`/`updatedAt` but nothing that means "I opened this book".
 *
 * Derived from the book id rather than randomised so it is stable across
 * re-renders and reopens; a random date that changed every time the dialog
 * opened would look like a bug. Replace with a real column when one exists.
 */
function fakeStartedReading(bookId: number): string {
  const daysAgo = 3 + ((bookId * 17) % 90);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BookDialog({
  book,
  onOpenChange,
  onSave,
}: {
  book: ShelfBook | null;
  onOpenChange: (open: boolean) => void;
  /** Resolves to the saved book, or throws so the dialog can show the error. */
  onSave: (book: ShelfBook, status: ReadStatus) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ReadStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync when a different book is opened, and clear any error left over
  // from the previous one.
  useEffect(() => {
    setDraft(book?.status ?? null);
    setError(null);
    setSaving(false);
  }, [book]);

  if (!book) return null;

  const status = draft ?? book.status;
  const isDirty = status !== book.status;

  async function handleSave() {
    if (!book || !isDirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(book, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={book !== null} onOpenChange={onOpenChange}>
      {/*
        `text-foreground` is explicit because shadcn's DialogContent sets
        bg-background but no text colour, leaving it to inherit from `body` —
        whose colour comes from the pre-shadcn variables, which follow
        prefers-color-scheme while the shadcn tokens do not.
      */}
      <DialogContent className="max-w-none! overflow-hidden p-0! text-foreground sm:w-[46rem]">
        <ResizablePanelGroup
          orientation="horizontal"
          // The panel group is h-full, so the height has to come from here or
          // the panels collapse to nothing.
          className="min-h-[24rem]"
        >
          {/*
            Sizes are strings on purpose. react-resizable-panels v4 reads a
            bare number as *pixels* and a bare string as a percentage, so
            defaultSize={42} would be a 42px panel, not 42%.
          */}
          <ResizablePanel defaultSize="42" minSize="25">
            <div className="flex h-full items-center justify-center bg-muted/40 p-6">
              <BookCover
                src={book.cover}
                title={book.title}
                className="max-h-[20rem] w-auto rounded-sm shadow-md"
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel defaultSize="58" minSize="35">
            <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
              <div className="flex flex-col gap-1">
                <DialogTitle className="text-xl leading-tight">
                  {book.title}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {book.author}
                </DialogDescription>
              </div>

              <div>
                <StatusBadge status={book.status} />
              </div>

              {/* Placeholder data — see fakeStartedReading above. */}
              <p className="text-xs text-muted-foreground/70">
                Started reading {fakeStartedReading(book.id)}
              </p>

              <Separator />

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="book-status"
                  className="text-sm font-medium"
                >
                  Reading status
                </label>
                <Select
                  value={status}
                  onValueChange={(next) => setDraft(next as ReadStatus)}
                >
                  <SelectTrigger id="book-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {READ_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <div className="mt-auto flex items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={!isDirty || saving}
                  className="border-0!"
                >
                  {saving ? "Updating…" : "Update"}
                </Button>
                {isDirty && !saving ? (
                  <span className="text-xs text-muted-foreground">
                    Unsaved change
                  </span>
                ) : null}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </DialogContent>
    </Dialog>
  );
}
