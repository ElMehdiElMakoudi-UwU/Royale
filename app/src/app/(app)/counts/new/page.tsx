import { CountForm } from "../count-form";
import { formGroups } from "../form-groups";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { today } from "@/lib/format";
import { getDict } from "@/lib/i18n";

export default async function NewCountPage({ searchParams }: PageProps<"/counts/new">) {
  const user = await requireUser();
  const { t, locale } = await getDict();
  const type = (await searchParams).type === "delivery" ? "delivery" : "stock";

  return (
    <>
      <PageHeader
        title={type === "delivery" ? t.counts.newDelivery : t.counts.newStock}
        subtitle={type === "delivery" ? t.home.newDeliveryCountHint : t.home.newStockCountHint}
        back={{ href: "/counts", label: t.counts.title }}
      />
      <CountForm
        // Remount when switching type so the right draft is loaded.
        key={type}
        t={{ counts: t.counts, common: t.common, units: t.units }}
        type={type}
        groups={formGroups(locale, t.products.noCategory)}
        canPickDate={user.role === "owner"}
        defaultDate={today()}
      />
    </>
  );
}
