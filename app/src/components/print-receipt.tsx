"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Receipt, type ReceiptData } from "./receipt";

const subscribe = () => () => {};

/** Renders the receipt as a direct child of <body>, where the print stylesheet can isolate it. */
export function ReceiptPortal({ data, header, footer }: { data: ReceiptData | null; header: string; footer: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  if (!mounted || !data) return null;
  return createPortal(
    <div id="receipt-root">
      <Receipt data={data} header={header} footer={footer} />
    </div>,
    document.body,
  );
}

/** Prints only the receipt currently rendered by <ReceiptPortal>. */
export function printReceipt() {
  document.body.classList.add("print-receipt");
  const cleanup = () => {
    document.body.classList.remove("print-receipt");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Let React commit the portal before the print dialog snapshots the page.
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}

/** Re-prints a past receipt; its portal only exists while printing, so several buttons can share a page. */
export function ReprintButton({
  data,
  header,
  footer,
  label,
}: {
  data: ReceiptData;
  header: string;
  footer: string;
  label: string;
}) {
  const [printing, setPrinting] = useState(false);
  const print = () => {
    setPrinting(true);
    const done = () => {
      setPrinting(false);
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    printReceipt();
  };
  return (
    <>
      <ReceiptPortal data={printing ? data : null} header={header} footer={footer} />
      <button type="button" onClick={print} className="btn-ghost h-9 px-3 text-xs">
        {label}
      </button>
    </>
  );
}
