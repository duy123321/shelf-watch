import {
  READ_STATUSES,
  STATUS_LABELS,
  type ShelfSummary,
  type User as UserRecord,
} from "@shelf-watch/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";

/** The left-column identity card: avatar, name, and the shelf stat grid. */
export default function ProfileCard({
  user,
  summary,
}: {
  user: UserRecord;
  summary: ShelfSummary;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center text-center">
        <Avatar className="size-24">
          <AvatarImage src={user.profilePicture ?? ""} alt="" />
          <AvatarFallback className="text-xl">
            {user.username.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <p className="mt-4 text-lg font-semibold">{user.username}</p>
        <p className="text-sm text-muted-foreground">@{user.username}</p>

        <dl className="mt-6 grid w-full grid-cols-2 gap-3 text-left">
          <Stat label="Books" value={summary.totalBooks} />
          {READ_STATUSES.map((readStatus) => (
            <Stat
              key={readStatus}
              label={STATUS_LABELS[readStatus]}
              value={summary.countsByStatus[readStatus]}
            />
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
