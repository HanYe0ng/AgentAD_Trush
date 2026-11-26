import { EVENT_TYPE_LABEL, type AdEventType } from "@/lib/events/spec";
import type { Verdict } from "@/lib/verification/engine";
import { Badge, type Tone } from "@/components/ui";

const EVENT_TONE: Record<AdEventType, Tone> = {
  AD_RECEIVED: "neutral",
  AD_RECOMMENDED: "info",
  AD_PRESENTED: "success",
  AD_VIEWABLE: "dark",
  AD_NOT_PRESENTED: "warning",
};

export function EventBadge({ type, className }: { type: AdEventType; className?: string }) {
  return (
    <Badge tone={EVENT_TONE[type]} className={className} >
      {EVENT_TYPE_LABEL[type]}
    </Badge>
  );
}

export const VERDICT_TONE: Record<Verdict, Tone> = {
  VALID: "success",
  INVALID: "danger",
  INCONCLUSIVE: "warning",
  DUPLICATE: "neutral",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <Badge tone={VERDICT_TONE[verdict]}>{verdict}</Badge>;
}
