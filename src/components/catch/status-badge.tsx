import {
  CATCH_STATUS_LABELS,
  CATCH_STATUS_TINT,
  TEMPERATURE_LABELS,
  TEMPERATURE_TINT,
  type CatchStatus,
  type Temperature,
} from "@/lib/catch-domain";
import { cn } from "@/lib/utils";

const base =
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tint-soft";

export function CatchStatusBadge({
  status,
  className,
}: {
  status: CatchStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(base, className)}
      style={{ ["--tint" as string]: CATCH_STATUS_TINT[status] }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: CATCH_STATUS_TINT[status] }}
        aria-hidden
      />
      {CATCH_STATUS_LABELS[status]}
    </span>
  );
}

export function TemperatureBadge({
  temperature,
  className,
}: {
  temperature: Temperature;
  className?: string;
}) {
  return (
    <span
      className={cn(base, className)}
      style={{ ["--tint" as string]: TEMPERATURE_TINT[temperature] }}
    >
      {TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
