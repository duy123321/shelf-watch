import {
  READ_STATUSES,
  STATUS_LABELS,
  type StatusCounts as Counts,
} from "@shelf-watch/shared";

/**
 * Iterates READ_STATUSES rather than Object.keys(counts) so the four tiles
 * always render in a stable order, even if the API ever reorders its keys.
 */
export default function StatusCounts({ counts }: { counts: Counts }) {
  return (
    <dl className="counts">
      {READ_STATUSES.map((status) => (
        <div key={status} className="count">
          <dt>{STATUS_LABELS[status]}</dt>
          <dd>{counts[status]}</dd>
        </div>
      ))}
    </dl>
  );
}
