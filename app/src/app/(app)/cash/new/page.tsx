import { desc } from "drizzle-orm";
import { ClosingForm } from "../closing-form";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/format";
import { getDict } from "@/lib/i18n";

export default async function NewClosingPage() {
  const user = await requireUser();
  const { t } = await getDict();
  // The morning float is usually the same every day: start from the last one.
  const last = db
    .select({ openingFloat: schema.cashClosings.openingFloat })
    .from(schema.cashClosings)
    .orderBy(desc(schema.cashClosings.date))
    .get();

  return (
    <>
      <PageHeader title={t.cash.close} subtitle={t.cash.closeHint} back={{ href: "/cash", label: t.cash.title }} />
      <ClosingForm
        t={{ ...t.cash, common: t.common }}
        canPickDate={user.role === "owner"}
        initial={{ date: today(), openingFloat: last?.openingFloat ?? 0, cashCounted: 0, card: 0, note: "", outflows: [] }}
      />
    </>
  );
}
