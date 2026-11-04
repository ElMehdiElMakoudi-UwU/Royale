/** Results ledger arithmetic. No database access, so the daily grid can use it in the browser too. */

export type ResultDay = {
  date: string;
  creditRoyale: number;
  morning: number;
  evening: number;
  expenses: number;
  ownerExpenses: number;
  note: string;
};

export type ResultTotals = {
  creditRoyale: number;
  sales: number;
  expenses: number;
  ownerExpenses: number;
  /** Sales − all expenses: the money left from the day's takings. */
  netCash: number;
  /** Sales − crédit Royale. */
  gross: number;
  /** Gross − all expenses. */
  net: number;
  /** Net + owner's personal costs, which aren't costs of the shop. */
  final: number;
  /** Days with takings, used for the daily average. */
  salesDays: number;
};

export type DateRange = { from: string; to: string };

export type ResultPeriod = DateRange & {
  totals: ResultTotals;
  /** The period's share of the monthly fixed charges. */
  fixedShare: number;
  /** Gross − fixed share. */
  resultWithFixed: number;
};

const addDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export const daysInMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** Every date from `from` to `to`, both included. */
export function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (let d = from; d <= to; d = addDay(d)) dates.push(d);
  return dates;
}

export const monthDates = (month: string) => datesBetween(`${month}-01`, `${month}-${String(daysInMonth(month)).padStart(2, "0")}`);

/** Cuts the month at each start date; starts outside the month, or on its first day, are ignored. */
export function monthPeriods(month: string, starts: string[]): DateRange[] {
  const dates = monthDates(month);
  const cuts = [...new Set(starts)].filter((s) => s > dates[0] && s <= dates[dates.length - 1]).sort();
  const firsts = [dates[0], ...cuts];
  return firsts.map((from, i) => ({
    from,
    to: i + 1 < firsts.length ? dates[dates.indexOf(firsts[i + 1]) - 1] : dates[dates.length - 1],
  }));
}

export function totalsOf(days: ResultDay[]): ResultTotals {
  const sum = (pick: (d: ResultDay) => number) => days.reduce((s, d) => s + pick(d), 0);
  const creditRoyale = sum((d) => d.creditRoyale);
  const sales = sum((d) => d.morning + d.evening);
  const expenses = sum((d) => d.expenses);
  const ownerExpenses = sum((d) => d.ownerExpenses);
  const gross = sales - creditRoyale;
  const net = gross - expenses;
  return {
    creditRoyale,
    sales,
    expenses,
    ownerExpenses,
    netCash: sales - expenses,
    gross,
    net,
    final: net + ownerExpenses,
    salesDays: days.filter((d) => d.morning + d.evening > 0).length,
  };
}

/**
 * The month's results, per period and overall.
 *
 * Fixed charges accrue by calendar day up to the last day entered, so a month in progress isn't
 * compared with a whole month of charges. Shares are rounded from running totals, so they always
 * add up to the month's figure.
 */
export function monthResults(input: {
  month: string;
  days: ResultDay[];
  periodStarts: string[];
  fixedTotal: number;
  markupPct: number;
}) {
  const { month, days, periodStarts, fixedTotal, markupPct } = input;
  const dates = monthDates(month);
  const inMonth = days.filter((d) => d.date >= dates[0] && d.date <= dates[dates.length - 1]);
  const lastEntered = inMonth.reduce((last, d) => (d.date > last ? d.date : last), "");

  let coveredDays = 0;
  let chargedSoFar = 0;
  const periods: ResultPeriod[] = monthPeriods(month, periodStarts).map(({ from, to }) => {
    const totals = totalsOf(inMonth.filter((d) => d.date >= from && d.date <= to));
    coveredDays += datesBetween(from, to).filter((d) => d <= lastEntered).length;
    const charged = Math.round((fixedTotal * coveredDays) / dates.length);
    const fixedShare = charged - chargedSoFar;
    chargedSoFar = charged;
    return { from, to, totals, fixedShare, resultWithFixed: totals.gross - fixedShare };
  });

  const totals = totalsOf(inMonth);
  const entered = new Set(inMonth.map((d) => d.date));
  const estimatedSales = Math.round(totals.creditRoyale * (1 + markupPct / 100));
  const shopExpenses = totals.expenses - totals.ownerExpenses;

  return {
    periods,
    totals,
    salesPerDay: totals.salesDays > 0 ? Math.round(totals.sales / totals.salesDays) : 0,
    estimatedSales,
    estimateGap: totals.sales - estimatedSales,
    /** Actual markup on what the factory charged; null without any crédit Royale. */
    actualMarkup: totals.creditRoyale > 0 ? (totals.sales - totals.creditRoyale) / totals.creditRoyale : null,
    fixedCharged: chargedSoFar,
    shopExpenses,
    /** Shop expenses − budgeted charges: positive means spending above the budget. */
    fixedGap: shopExpenses - chargedSoFar,
    resultWithFixed: totals.gross - chargedSoFar,
    warnings: {
      /** Days before the last one entered with nothing typed. */
      missingDays: dates.filter((d) => d < lastEntered && !entered.has(d)),
      /** Takings without a factory cost: usually a forgotten crédit Royale. */
      noCreditDays: inMonth.filter((d) => d.morning + d.evening > 0 && d.creditRoyale === 0).map((d) => d.date),
      /** The owner's costs are part of expenses, so they can't be larger. */
      ownerOverExpensesDays: inMonth.filter((d) => d.ownerExpenses > d.expenses).map((d) => d.date),
    },
  };
}
