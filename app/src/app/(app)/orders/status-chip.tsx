import type { OrderStatus } from "@/db/schema";

const styles: Record<OrderStatus, string> = {
  pending: "bg-warn-soft text-warn",
  ready: "bg-gold-soft text-cocoa",
  delivered: "bg-ok-soft text-ok",
  cancelled: "bg-cream text-muted ring-1 ring-line",
};

export function OrderStatusChip({ status, t }: { status: OrderStatus; t: { statuses: Record<OrderStatus, string> } }) {
  return <span className={`chip ${styles[status]}`}>{t.statuses[status]}</span>;
}
