"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { printReceipt, ReceiptPortal } from "@/components/print-receipt";
import type { ReceiptData } from "@/components/receipt";
import type { Dict } from "@/lib/i18n/fr";
import { recordSale, type SaleInput } from "./actions";

export type PosProduct = {
  id: number;
  label: string;
  alt: string;
  unit: "piece" | "kg" | "box";
  price: number | null;
  category: string;
};

type Line = { key: string; productId: number; label: string; unit: PosProduct["unit"]; qty: number; unitPrice: number };
type Modal = null | { kind: "weight" | "price"; product: PosProduct } | { kind: "cash" };

type Props = {
  t: Dict["pos"] & { units: Dict["units"] };
  products: PosProduct[];
  categories: { key: string; label: string }[];
  cashier: string;
  todayTotal: number;
  receipt: { header: string; footer: string; autoPrint: boolean };
};

const QUEUE_KEY = "pos-queue";
const fmt = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lineTotal = (l: Pick<Line, "qty" | "unitPrice">) => Math.round(l.qty * l.unitPrice);
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readQueue(): SaleInput[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeQueue(q: SaleInput[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
}

/** Sends a sale; returns false when the server couldn't be reached (the sale must be queued). */
async function send(sale: SaleInput) {
  try {
    const res = await recordSale(sale);
    // An invalid sale will never succeed: drop it rather than block the queue forever.
    if (!res.ok) console.error("Sale rejected by server", sale);
    return true;
  } catch {
    return false;
  }
}

function Numpad({
  title,
  value,
  onChange,
  decimals,
}: {
  title: string;
  value: string;
  onChange: (v: string) => void;
  decimals: boolean;
}) {
  const press = (k: string) => {
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === ",") return value.includes(",") || !decimals ? undefined : onChange((value || "0") + ",");
    if (value.includes(",") && value.split(",")[1].length >= (decimals ? 3 : 0)) return;
    onChange(value === "0" ? k : value + k);
  };
  return (
    <div>
      <div className="mb-1 text-sm text-muted">{title}</div>
      <div className="tabular mb-3 h-16 rounded-xl border border-line bg-cream px-4 text-end text-4xl font-semibold leading-[4rem] text-cocoa" dir="ltr">
        {value || "0"}
      </div>
      <div className="grid grid-cols-3 gap-2" dir="ltr">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3", ",", "0", "⌫"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={k === "," && !decimals}
            className="h-16 rounded-xl border border-line bg-paper text-2xl font-semibold text-ink active:bg-gold-soft disabled:opacity-30"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

const toNumber = (s: string) => Number((s || "0").replace(",", "."));

export function Register({ t, products, categories, cashier, todayTotal, receipt }: Props) {
  const [lines, setLines] = useState<Line[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [pad, setPad] = useState("");
  const [done, setDone] = useState<ReceiptData | null>(null);
  const [dayTotal, setDayTotal] = useState(todayTotal);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);

  const total = lines.reduce((s, l) => s + lineTotal(l), 0);

  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      const sent = new Set<string>();
      let failed = false;
      for (const sale of readQueue()) {
        if (await send(sale)) sent.add(sale.clientId);
        else {
          failed = true;
          break;
        }
      }
      // Re-read: a sale may have been queued while we were sending.
      const left = readQueue().filter((s) => !sent.has(s.clientId));
      writeQueue(left);
      setQueued(left.length);
      setOnline(!failed);
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    // Retry sales made while the connection was down.
    const tick = () => void flush();
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 20000);
    const goOnline = () => {
      setOnline(true);
      tick();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flush]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q || normalize(p.label).includes(q) || normalize(p.alt).includes(q)),
    );
  }, [products, category, query]);

  const add = (product: PosProduct, qty: number, unitPrice: number) => {
    setLines((ls) => {
      // Pieces of the same product at the same price stack on one line; weighed items stay separate.
      const same = product.unit !== "kg" && ls.find((l) => l.productId === product.id && l.unitPrice === unitPrice);
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { key: uuid(), productId: product.id, label: product.label, unit: product.unit, qty, unitPrice }];
    });
  };

  const tap = (p: PosProduct) => {
    if (p.price == null) {
      setPad("");
      setModal({ kind: "price", product: p });
    } else if (p.unit === "kg") {
      setPad("");
      setModal({ kind: "weight", product: p });
    } else {
      add(p, 1, p.price);
    }
  };

  const confirmPad = () => {
    if (!modal || modal.kind === "cash") return;
    const n = toNumber(pad);
    if (!(n > 0)) return;
    const p = modal.product;
    if (modal.kind === "price") {
      // Product with no catalog price: the cashier types the price of the item.
      add(p, 1, Math.round(n * 100));
    } else {
      add(p, Math.round(n * 1000) / 1000, p.price!);
    }
    setModal(null);
  };

  const step = (key: string, delta: number) =>
    setLines((ls) =>
      ls.flatMap((l) => (l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: l.qty + delta }])),
    );

  const finish = (payment: "cash" | "card", cashGiven: number | null) => {
    if (lines.length === 0) return;
    const sale: SaleInput = {
      clientId: uuid(),
      soldAt: new Date().toISOString(),
      payment,
      cashGiven,
      lines: lines.map((l) => ({ productId: l.productId, label: l.label, qty: l.qty, unitPrice: l.unitPrice })),
    };
    const data: ReceiptData = {
      ref: sale.clientId.slice(0, 8).toUpperCase(),
      soldAt: sale.soldAt,
      cashier,
      lines: lines.map((l) => ({ label: l.label, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, total: lineTotal(l) })),
      total,
      payment,
      cashGiven,
    };
    setDone(data);
    setDayTotal((d) => d + total);
    setLines([]);
    setModal(null);
    if (receipt.autoPrint) printReceipt();
    // Never make the customer wait for the network: queue first, then try to send.
    writeQueue([...readQueue(), sale]);
    setQueued(readQueue().length);
    void flush();
  };

  const cashGiven = Math.round(toNumber(pad) * 100);
  const quickAmounts = [...new Set([total, ...[2000, 5000, 10000, 20000].map((b) => Math.ceil(total / b) * b)])]
    .filter((v) => v >= total)
    .slice(0, 4);

  return (
    <div className="flex h-dvh flex-col bg-cream">
      <ReceiptPortal data={done} header={receipt.header} footer={receipt.footer} />

      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper px-3">
        <Link href="/" className="btn-ghost h-10 px-3">
          <span className="rtl:rotate-180">←</span> {t.back}
        </Link>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className="field h-10 max-w-xs py-1"
        />
        <div className="ms-auto flex items-center gap-4 text-sm">
          {(!online || queued > 0) && (
            <span className="chip bg-warn-soft py-1 text-warn">
              {!online && `${t.offline} · `}
              {queued > 0 && `${queued} ${t.queued}`}
            </span>
          )}
          <span className="text-muted">{cashier}</span>
          <span className="tabular hidden sm:inline">
            <span className="text-muted">{t.today} </span>
            <span className="font-semibold text-cocoa">{fmt(dayTotal)}</span>
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] lg:grid-cols-[1fr_380px] lg:grid-rows-1">
        {/* Products */}
        <div className="flex min-h-0 flex-col">
          <div className="flex shrink-0 gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none]">
            {[{ key: null, label: t.all }, ...categories].map((c) => (
              <button
                key={c.key ?? "all"}
                onClick={() => setCategory(c.key)}
                className={`h-11 shrink-0 rounded-full px-5 text-sm font-semibold ring-1 transition ${
                  category === c.key ? "bg-cocoa text-white ring-cocoa" : "bg-paper text-ink ring-line"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-[96px] grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-2 overflow-y-auto p-3 pt-1">
            {visible.map((p) => (
              <button
                key={p.id}
                onClick={() => tap(p)}
                className="flex flex-col justify-between rounded-2xl border border-line bg-paper p-3 text-start shadow-sm transition active:scale-[0.97] active:bg-gold-soft"
              >
                <span className="line-clamp-2 text-sm font-semibold leading-tight">{p.label}</span>
                <span className="tabular flex items-baseline justify-between text-xs text-muted">
                  <span>{p.unit === "kg" ? t.units.kg : ""}</span>
                  <span className={p.price == null ? "text-warn" : "text-base font-semibold text-cocoa"}>
                    {p.price == null ? t.noPrice : fmt(p.price)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Ticket */}
        <aside className="flex max-h-[45dvh] min-h-0 flex-col border-t border-line bg-paper lg:max-h-none lg:border-s lg:border-t-0">
          <div className="flex items-center justify-between px-4 py-2.5">
            <h2 className="font-semibold text-cocoa">{t.cart}</h2>
            {lines.length > 0 && (
              <button onClick={() => confirm(t.confirmClear) && setLines([])} className="text-sm text-bad">
                {t.clear}
              </button>
            )}
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto border-y border-line">
            {lines.length === 0 && <li className="p-6 text-center text-sm text-muted">{t.empty}</li>}
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.label}</div>
                  <div className="tabular text-xs text-muted" dir="ltr">
                    {l.unit === "kg" ? `${l.qty.toLocaleString("fr-FR")} kg` : l.qty} × {fmt(l.unitPrice)}
                  </div>
                </div>
                {l.unit !== "kg" && (
                  <div className="flex items-center gap-1" dir="ltr">
                    <button onClick={() => step(l.key, -1)} className="grid size-10 place-items-center rounded-lg border border-line text-lg active:bg-cream">
                      −
                    </button>
                    <button onClick={() => step(l.key, 1)} className="grid size-10 place-items-center rounded-lg border border-line text-lg active:bg-cream">
                      +
                    </button>
                  </div>
                )}
                {l.unit === "kg" && (
                  <button onClick={() => step(l.key, -l.qty)} className="grid size-10 place-items-center rounded-lg border border-line text-lg text-bad">
                    ×
                  </button>
                )}
                <div className="tabular w-20 text-end font-semibold">{fmt(lineTotal(l))}</div>
              </li>
            ))}
          </ul>
          <div className="space-y-3 p-3">
            <div className="tabular flex items-baseline justify-between">
              <span className="text-muted">{t.total}</span>
              <span className="text-3xl font-semibold text-cocoa">
                {fmt(total)} <span className="text-base font-normal text-muted">DH</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={lines.length === 0}
                onClick={() => {
                  setPad("");
                  setModal({ kind: "cash" });
                }}
                className="h-16 rounded-2xl bg-cocoa text-lg font-semibold text-white active:bg-cocoa-dark disabled:opacity-40"
              >
                {t.cash}
              </button>
              <button
                disabled={lines.length === 0}
                onClick={() => finish("card", null)}
                className="h-16 rounded-2xl border-2 border-cocoa text-lg font-semibold text-cocoa active:bg-gold-soft disabled:opacity-40"
              >
                {t.card}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Number pad for weight / price / cash given */}
      {modal && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-ink/40 p-4" onClick={() => setModal(null)}>
          <div className="card w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {modal.kind === "cash" ? (
              <>
                <div className="tabular mb-3 flex justify-between text-lg">
                  <span className="text-muted">{t.total}</span>
                  <span className="font-semibold">{fmt(total)}</span>
                </div>
                <div className="mb-3 grid grid-cols-4 gap-2" dir="ltr">
                  {quickAmounts.map((v) => (
                    <button
                      key={v}
                      onClick={() => setPad(String(v / 100).replace(".", ","))}
                      className="tabular h-11 rounded-lg bg-gold-soft text-sm font-semibold text-cocoa"
                    >
                      {v === total ? t.exact : fmt(v).replace(",00", "")}
                    </button>
                  ))}
                </div>
                <Numpad title={t.given} value={pad} onChange={setPad} decimals />
                <div className="tabular mt-3 flex justify-between text-lg">
                  <span className="text-muted">{t.change}</span>
                  <span className={`font-semibold ${cashGiven >= total ? "text-ok" : "text-bad"}`}>
                    {pad === "" ? "—" : cashGiven >= total ? fmt(cashGiven - total) : t.notEnough}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => setModal(null)} className="btn-ghost h-14">{t.cancel}</button>
                  <button
                    // Empty pad = exact amount given.
                    onClick={() => finish("cash", pad === "" ? total : cashGiven)}
                    disabled={pad !== "" && cashGiven < total}
                    className="btn-primary h-14 text-base"
                  >
                    {t.validate}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-3 font-semibold text-cocoa">{modal.product.label}</div>
                <Numpad
                  title={modal.kind === "weight" ? t.weight : t.price}
                  value={pad}
                  onChange={setPad}
                  decimals
                />
                {modal.kind === "weight" && modal.product.price != null && (
                  <div className="tabular mt-3 flex justify-between text-lg">
                    <span className="text-muted">{fmt(modal.product.price)} / kg</span>
                    <span className="font-semibold">{fmt(Math.round(toNumber(pad) * modal.product.price))}</span>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => setModal(null)} className="btn-ghost h-14">{t.cancel}</button>
                  <button onClick={confirmPad} disabled={!(toNumber(pad) > 0)} className="btn-primary h-14 text-base">
                    {t.validate}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sale done */}
      {done && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/50 p-4">
          <div className="card w-full max-w-sm p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-ok-soft text-3xl text-ok">✓</div>
            <div className="font-semibold text-cocoa">{t.done}</div>
            <div className="tabular mt-1 text-sm text-muted">
              {t.total} {fmt(done.total)} DH
            </div>
            {done.payment === "cash" && done.cashGiven != null && done.cashGiven > done.total && (
              <div className="tabular mt-4 rounded-xl bg-gold-soft p-4">
                <div className="text-sm text-muted">{t.change}</div>
                <div className="text-4xl font-semibold text-cocoa">{fmt(done.cashGiven - done.total)}</div>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={printReceipt} className="btn-ghost h-14">{t.print}</button>
              <button onClick={() => setDone(null)} className="btn-primary h-14 text-base">{t.newSale}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
