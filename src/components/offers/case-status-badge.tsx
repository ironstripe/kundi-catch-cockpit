import { Badge } from "@/components/ui/badge";
import { CASE_STATUS_LABELS, type CaseStatus } from "@/lib/offer-cases";

const VARIANTS: Record<CaseStatus, "default" | "secondary" | "outline"> = {
  review: "default",
  ready: "default",
  converted: "secondary",
  ignored: "outline",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={VARIANTS[status]}>{CASE_STATUS_LABELS[status]}</Badge>;
}
