export type OrderSlipData = {
  ref: string;
  customerName: string;
  customerPhone: string;
  occasion: string;
  pickup: string;
  deliveryAddress: string;
  note: string;
  lines: { label: string; qty: number; unitPrice: number; total: number }[];
  total: number;
  paid: number;
};

const dh = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** 80 mm slip given to the customer when an order is taken. Always in French, like the receipt. */
export function OrderSlip({ data, header, footer }: { data: OrderSlipData; header: string; footer: string }) {
  return (
    <div className="receipt" dir="ltr">
      {header && (
        <div className="receipt-center receipt-header">
          {header.split("\n").map((l, i) => (
            <div key={i} className={i === 0 ? "receipt-title" : ""}>{l}</div>
          ))}
        </div>
      )}
      <div className="receipt-center receipt-title">BON DE COMMANDE N° {data.ref}</div>
      <div className="receipt-sep" />
      <div>Client : {data.customerName}</div>
      {data.customerPhone && <div>Tél : {data.customerPhone}</div>}
      <div>Occasion : {data.occasion}</div>
      <div className="receipt-title">Retrait : {data.pickup}</div>
      {data.deliveryAddress && <div>Livraison : {data.deliveryAddress}</div>}
      <div className="receipt-sep" />
      {data.lines.map((l, i) => (
        <div key={i} className="receipt-line">
          <div>{l.label}</div>
          <div className="receipt-row">
            <span>{qty(l.qty)} x {dh(l.unitPrice)}</span>
            <span>{dh(l.total)}</span>
          </div>
        </div>
      ))}
      {data.note && (
        <>
          <div className="receipt-sep" />
          <div style={{ whiteSpace: "pre-wrap" }}>{data.note}</div>
        </>
      )}
      <div className="receipt-sep" />
      <div className="receipt-row receipt-total">
        <span>TOTAL</span>
        <span>{dh(data.total)} DH</span>
      </div>
      <div className="receipt-row">
        <span>Avance versée</span>
        <span>{dh(data.paid)}</span>
      </div>
      <div className="receipt-row receipt-total">
        <span>RESTE À PAYER</span>
        <span>{dh(Math.max(0, data.total - data.paid))} DH</span>
      </div>
      {footer && (
        <>
          <div className="receipt-sep" />
          <div className="receipt-center">
            {footer.split("\n").map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
