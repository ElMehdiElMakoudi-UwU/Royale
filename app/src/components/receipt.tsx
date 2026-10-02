export type ReceiptData = {
  ref: string;
  soldAt: string;
  cashier: string;
  lines: { label: string; qty: number; unit: "piece" | "kg" | "box"; unitPrice: number; total: number }[];
  total: number;
  payment: "cash" | "card";
  cashGiven: number | null;
  voided?: boolean;
};

const dh = (c: number) => (c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 3 });

/** 80 mm thermal receipt. Always in French; layout uses a monospace font so columns line up. */
export function Receipt({ data, header, footer }: { data: ReceiptData; header: string; footer: string }) {
  const when = new Date(data.soldAt).toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="receipt" dir="ltr">
      {header && (
        <div className="receipt-center receipt-header">
          {header.split("\n").map((l, i) => (
            <div key={i} className={i === 0 ? "receipt-title" : ""}>{l}</div>
          ))}
        </div>
      )}
      <div className="receipt-row">
        <span>{when}</span>
        <span>N° {data.ref}</span>
      </div>
      <div>Caissier : {data.cashier}</div>
      {data.voided && <div className="receipt-center receipt-title">*** ANNULÉ ***</div>}
      <div className="receipt-sep" />
      {data.lines.map((l, i) => (
        <div key={i} className="receipt-line">
          <div>{l.label}</div>
          <div className="receipt-row">
            <span>
              {l.unit === "kg" ? `${qty(l.qty)} kg` : qty(l.qty)} x {dh(l.unitPrice)}
            </span>
            <span>{dh(l.total)}</span>
          </div>
        </div>
      ))}
      <div className="receipt-sep" />
      <div className="receipt-row receipt-total">
        <span>TOTAL</span>
        <span>{dh(data.total)} DH</span>
      </div>
      {data.payment === "cash" ? (
        <>
          <div className="receipt-row">
            <span>Espèces</span>
            <span>{dh(data.cashGiven ?? data.total)}</span>
          </div>
          {data.cashGiven != null && data.cashGiven > data.total && (
            <div className="receipt-row">
              <span>Rendu</span>
              <span>{dh(data.cashGiven - data.total)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="receipt-row">
          <span>Carte</span>
          <span>{dh(data.total)}</span>
        </div>
      )}
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
