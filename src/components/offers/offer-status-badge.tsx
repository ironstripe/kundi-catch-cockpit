import { Badge } from "@/components/ui/badge";
import { OFFER_STATUS_LABELS, type OfferStatus } from "@/lib/supplier-offers";

const VARIANTS: Record<OfferStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  extracting: "secondary",
  review: "default",
  converted: "secondary",
  ignored: "outline",
  failed: "destructive",
};

export function OfferStatusBadge({ status }: { status: OfferStatus }) {
  return <Badge variant={VARIANTS[status]}>{OFFER_STATUS_LABELS[status]}</Badge>;
}
