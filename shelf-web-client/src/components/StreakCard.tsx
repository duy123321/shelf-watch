import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder: nothing in the API records reading activity per day yet, so the
// week renders empty. Wire it up once the contract carries activity dates.
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export default function StreakCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly streak</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">0</p>
        <p className="text-xs text-muted-foreground">weeks in a row</p>

        <div className="mt-4 flex justify-between gap-1">
          {WEEKDAYS.map((day, index) => (
            <div key={index} className="flex flex-col items-center gap-1">
              <div className="size-7 rounded-full border bg-muted" />
              <span className="text-[10px] text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
