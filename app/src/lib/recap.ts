import "server-only";
import { and, count, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { today } from "./format";
import { addDays, factoryAccount, monthResult } from "./money";
import { openOrders } from "./orders";
import { monthResultsData } from "./results";
import { closingRevenue, outflowTotals, posByDay } from "./sales";

/** Everything the owner's recap shows for one shop: today, the given month, and what needs attention. */
export function shopRecap(shopId: number, month: string) {
  const day = today();

  const register = posByDay(shopId, day, addDays(day, 1)).days.get(day);
  const closing = db
    .select()
    .from(schema.cashClosings)
    .where(and(eq(schema.cashClosings.shopId, shopId), eq(schema.cashClosings.date, day)))
    .get();

  const ledger = monthResultsData(shopId, month).results;
  const bilan = monthResult(shopId, month);
  const factory = factoryAccount(shopId);
  const late = openOrders(shopId, day).length;

  const pending = (table: typeof schema.counts | typeof schema.cashClosings) =>
    db
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.shopId, shopId), eq(table.status, "submitted")))
      .get()!.n;

  return {
    today: {
      registerTotal: (register?.cash ?? 0) + (register?.card ?? 0),
      tickets: register?.count ?? 0,
      closingRevenue: closing ? closingRevenue(closing, outflowTotals([closing.id]).get(closing.id) ?? 0) : null,
    },
    ledger,
    bilan: {
      sales: bilan.sales + bilan.orderTransfers,
      purchases: bilan.purchases,
      expenses: bilan.expenses.total,
      salaries: bilan.salaries.total,
      result: bilan.result,
    },
    factory: { balance: factory.balance, draftTotal: factory.draftTotal },
    todo: {
      counts: pending(schema.counts),
      notes: factory.drafts,
      closings: pending(schema.cashClosings),
      outflows: bilan.expenses.unclassified,
      lateOrders: late,
      // Today's and tomorrow's pickups, the late ones being counted apart.
      dueOrders: openOrders(shopId, addDays(day, 2)).length - late,
      missingDays: ledger.warnings.missingDays.length,
    },
  };
}
