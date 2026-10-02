import Link from "next/link";
import { addFactoryEntry, deleteFactoryEntry } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyBox } from "@/components/copy-box";
import { PageHeader, SectionTitle } from "@/components/ui";
import { FACTORY_ENTRY_KINDS, PAYMENT_METHODS } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { dateLabel, money, today } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { factoryAccount, type FactoryWeek } from "@/lib/money";

const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dh = (c: number) => `${money(c)} DH`;
const METHOD_FR = { cash: "espèces", transfer: "virement", cheque: "chèque", other: "autre" } as const;

/** Weekly statement in French, ready to send to the factory. */
function statement(w: FactoryWeek) {
  const out = [`Relevé semaine du ${short(w.start)} au ${short(w.end)}/${w.end.slice(0, 4)}`, `Solde précédent : ${dh(w.opening)}`];
  if (w.openingAdded) out.push(`Solde de départ : ${dh(w.openingAdded)}`);
  if (w.notes.length) {
    out.push("", "Bons :");
    for (const n of w.notes) {
      const disputed = n.declaredTotal != null && n.acceptedTotal !== n.declaredTotal;
      out.push(
        `- ${n.blNumber || "bon"} du ${short(n.date)} : ${dh(n.acceptedTotal ?? 0)}${disputed ? ` (facturé ${dh(n.declaredTotal!)})` : ""}`,
      );
    }
    out.push(`Total bons : ${dh(w.notesTotal)}`);
  }
  const payments = w.entries.filter((e) => e.kind !== "opening");
  if (payments.length) {
    out.push("", "Paiements :");
    for (const e of payments) {
      const what = e.kind === "credit" ? "avoir" : (e.method ? METHOD_FR[e.method] : "paiement");
      out.push(`- ${short(e.date)} ${what}${e.reference ? ` ${e.reference}` : ""} : ${dh(e.amount)}`);
    }
  }
  out.push("", `Solde à payer : ${dh(w.closing)}`);
  return out.join("\n");
}

export default async function FactoryPage() {
  await requireOwner();
  const { t, locale } = await getDict();
  const tf = t.factory;
  const account = factoryAccount();

  return (
    <>
      <PageHeader title={tf.title} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="card p-5">
          <div className="text-sm text-muted">{tf.balance}</div>
          <div className={`tabular mt-1 text-3xl font-semibold ${account.balance > 0 ? "text-cocoa" : "text-ok"}`}>
            {money(account.balance)} <span className="text-base font-normal text-muted">{t.common.dh}</span>
          </div>
          <div className="mt-1 text-xs text-muted">{tf.balanceHint}</div>
          {account.drafts > 0 && (
            <Link href="/deliveries" className="mt-3 block rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">
              ⚠ {account.drafts} {tf.drafts} ({money(account.draftTotal)} {t.common.dh})
            </Link>
          )}
        </div>

        <form action={addFactoryEntry} className="card space-y-3 p-4">
          <h2 className="font-semibold text-cocoa">{tf.addEntry}</h2>
          <div className="grid grid-cols-2 gap-3">
            <select name="kind" defaultValue={account.weeks.length ? "payment" : "opening"} className="field col-span-2" aria-label={tf.kind}>
              {FACTORY_ENTRY_KINDS.map((k) => (
                <option key={k} value={k}>{tf.kinds[k]}</option>
              ))}
            </select>
            <input name="date" type="date" defaultValue={today()} className="field" aria-label={tf.date} required />
            <input name="amount" inputMode="decimal" dir="ltr" placeholder={`${tf.amount} (${t.common.dh})`} className="field tabular" required />
            <select name="method" defaultValue="transfer" className="field" aria-label={tf.method}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{tf.methods[m]}</option>
              ))}
            </select>
            <input name="reference" placeholder={tf.reference} className="field" />
          </div>
          <button className="btn-primary w-full">{tf.save}</button>
          {account.weeks.length === 0 && <p className="text-xs text-muted">{tf.openingHint}</p>}
        </form>
      </div>

      {account.weeks.length === 0 ? (
        <p className="card p-8 text-center text-muted">{tf.noData}</p>
      ) : (
        <section>
          <SectionTitle>{tf.week}</SectionTitle>
          <ul className="space-y-3">
            {account.weeks.map((w, i) => (
              <li key={w.start} className="card overflow-hidden">
                <details open={i === 0}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-cream [&::-webkit-details-marker]:hidden">
                    <div className="min-w-36 flex-1 font-medium">
                      {dateLabel(w.start, locale)} → {dateLabel(w.end, locale)}
                    </div>
                    <div className="tabular grid grid-cols-4 gap-3 text-end text-sm">
                      <div>
                        <div className="text-xs text-muted">{tf.opening}</div>
                        {money(w.opening)}
                      </div>
                      <div>
                        <div className="text-xs text-muted">+ {tf.notes}</div>
                        {money(w.notesTotal + w.openingAdded)}
                      </div>
                      <div>
                        <div className="text-xs text-muted">− {tf.paid}</div>
                        {money(w.paid)}
                      </div>
                      <div>
                        <div className="text-xs text-muted">{tf.closing}</div>
                        <span className="font-semibold text-cocoa">{money(w.closing)}</span>
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-4 border-t border-line px-4 py-4">
                    {w.notes.length > 0 && (
                      <ul className="divide-y divide-line text-sm">
                        {w.notes.map((n) => (
                          <li key={n.id} className="tabular flex items-center justify-between gap-3 py-2">
                            <Link href={`/deliveries/${n.id}`} className="font-medium text-cocoa underline-offset-4 hover:underline">
                              <span dir="ltr">{n.blNumber || "—"}</span> · {dateLabel(n.date, locale)}
                            </Link>
                            <span className="text-end">
                              {money(n.acceptedTotal)}
                              {n.declaredTotal != null && n.declaredTotal !== n.acceptedTotal && (
                                <span className="block text-xs text-muted">
                                  {tf.invoiced} {money(n.declaredTotal)}
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {w.entries.length > 0 && (
                      <ul className="divide-y divide-line rounded-lg bg-cream text-sm">
                        {w.entries.map((e) => (
                          <li key={e.id} className="tabular flex items-center gap-3 px-3 py-2">
                            <span className="flex-1">
                              {dateLabel(e.date, locale)} · {tf.kinds[e.kind]}
                              {e.method && ` · ${tf.methods[e.method]}`}
                              {e.reference && <span className="text-muted" dir="ltr"> · {e.reference}</span>}
                            </span>
                            <span className={e.kind === "opening" ? "" : "text-ok"}>
                              {e.kind === "opening" ? "+" : "−"} {money(e.amount)}
                            </span>
                            <form action={deleteFactoryEntry.bind(null, e.id)}>
                              <ConfirmButton message={tf.confirmDelete} className="text-xs text-bad hover:underline">
                                {tf.delete}
                              </ConfirmButton>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div>
                      <SectionTitle>{tf.statement}</SectionTitle>
                      <CopyBox text={statement(w)} labels={{ copy: t.deliveries.copy, copied: t.deliveries.copied }} />
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
