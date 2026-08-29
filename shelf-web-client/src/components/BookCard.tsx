import { STATUS_LABELS, type ShelfBook } from "@shelf-watch/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * One book on a shelf. Shared so the shelf page can drop the hand-rolled
 * BookList for this once it is ported off the pre-shadcn styles.
 */
export default function BookCard({ book }: { book: ShelfBook }) {
  return (
    <Card className="h-full gap-3 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-sm leading-snug">{book.title}</CardTitle>
        <p className="text-xs text-muted-foreground">{book.author}</p>
      </CardHeader>
      <CardContent className="px-4">
        <Badge variant="secondary">{STATUS_LABELS[book.status]}</Badge>
      </CardContent>
    </Card>
  );
}
