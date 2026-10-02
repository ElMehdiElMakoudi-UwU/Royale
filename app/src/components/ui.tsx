import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  back,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-cocoa">
          <span className="rtl:rotate-180">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-cocoa sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {children && <div className="flex gap-2">{children}</div>}
      </div>
    </div>
  );
}

export function StatusChip({ validated, t }: { validated: boolean; t: { submitted: string; validated: string } }) {
  return validated ? (
    <span className="chip bg-ok-soft text-ok">{t.validated}</span>
  ) : (
    <span className="chip bg-warn-soft text-warn">{t.submitted}</span>
  );
}

export function TypeChip({ type, t }: { type: "stock" | "delivery"; t: { stock: string; delivery: string } }) {
  return type === "delivery" ? (
    <span className="chip bg-gold-soft text-cocoa">{t.delivery}</span>
  ) : (
    <span className="chip bg-cream text-muted ring-1 ring-line">{t.stock}</span>
  );
}

export function MonthNav({ month, label, prev, next }: { month: string; label: string; prev: string; next: string }) {
  return (
    <div className="flex items-center gap-1" data-month={month}>
      <Link href={`?month=${prev}`} className="btn-ghost size-11 px-0" aria-label="‹">
        <span className="rtl:rotate-180">‹</span>
      </Link>
      <span className="min-w-36 text-center font-semibold capitalize text-cocoa">{label}</span>
      <Link href={`?month=${next}`} className="btn-ghost size-11 px-0" aria-label="›">
        <span className="rtl:rotate-180">›</span>
      </Link>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{children}</h2>;
}
