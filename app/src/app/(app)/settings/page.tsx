import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/ui";
import { Receipt } from "@/components/receipt";
import { requireOwner } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { getSettings, saveSettings } from "@/lib/settings";

async function save(form: FormData) {
  "use server";
  await requireOwner();
  saveSettings({
    receiptHeader: String(form.get("receiptHeader") ?? "").trim().slice(0, 500),
    receiptFooter: String(form.get("receiptFooter") ?? "").trim().slice(0, 500),
    autoPrint: form.get("autoPrint") === "on",
  });
  revalidatePath("/settings");
  revalidatePath("/pos");
}

export default async function SettingsPage() {
  await requireOwner();
  const { t } = await getDict();
  const ts = t.settings;
  const s = getSettings();

  return (
    <>
      <PageHeader title={ts.title} />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <form action={save} className="card max-w-xl space-y-4 p-5">
          <h2 className="font-semibold text-cocoa">{ts.receipt}</h2>
          <div>
            <label className="label" htmlFor="receiptHeader">{ts.header}</label>
            <textarea id="receiptHeader" name="receiptHeader" dir="ltr" rows={4} defaultValue={s.receiptHeader} className="field font-mono text-sm" />
            <p className="mt-1 text-xs text-muted">{ts.headerHint}</p>
          </div>
          <div>
            <label className="label" htmlFor="receiptFooter">{ts.footer}</label>
            <textarea id="receiptFooter" name="receiptFooter" dir="ltr" rows={2} defaultValue={s.receiptFooter} className="field font-mono text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="autoPrint" defaultChecked={s.autoPrint} className="size-4 accent-cocoa" />
            {ts.autoPrint}
          </label>
          <button className="btn-primary">{ts.save}</button>
          <div className="rounded-lg bg-cream p-3 text-xs text-muted">
            <span className="font-semibold">{ts.printer} : </span>
            {ts.printerHint}
          </div>
        </form>

        <div className="self-start rounded-lg border border-line bg-white p-4 shadow-sm">
          <Receipt
            header={s.receiptHeader}
            footer={s.receiptFooter}
            data={{
              ref: "A1B2C3D4",
              soldAt: new Date().toISOString(),
              cashier: "—",
              lines: [
                { label: "Croissant amande", qty: 2, unit: "piece", unitPrice: 800, total: 1600 },
                { label: "Briouate amande", qty: 0.5, unit: "kg", unitPrice: 18000, total: 9000 },
              ],
              total: 10600,
              payment: "cash",
              cashGiven: 20000,
            }}
          />
        </div>
      </div>
    </>
  );
}
