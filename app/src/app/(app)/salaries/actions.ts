"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { SALARY_KINDS } from "@/db/schema";
import { formAmount, formDate, formId, formMonth, formText } from "@/lib/form";
import { requireOwnerShop } from "@/lib/shop";

function revalidate() {
  revalidatePath("/salaries");
  revalidatePath("/report");
}

export async function addEmployee(form: FormData) {
  const { shop } = await requireOwnerShop();
  const name = formText(form, "name", 100);
  const monthlySalary = formAmount(form, "monthlySalary");
  if (!name || !monthlySalary) return;
  db.insert(schema.employees).values({ shopId: shop.id, name, monthlySalary }).run();
  revalidate();
}

export async function updateSalary(id: number, form: FormData) {
  const { shop } = await requireOwnerShop();
  const monthlySalary = formAmount(form, "monthlySalary");
  if (!monthlySalary) return;
  db.update(schema.employees).set({ monthlySalary }).where(and(eq(schema.employees.id, id), eq(schema.employees.shopId, shop.id))).run();
  revalidate();
}

export async function setEmployeeActive(id: number, active: boolean) {
  const { shop } = await requireOwnerShop();
  db.update(schema.employees).set({ active }).where(and(eq(schema.employees.id, id), eq(schema.employees.shopId, shop.id))).run();
  revalidate();
}

export async function addSalaryPayment(form: FormData) {
  const { shop } = await requireOwnerShop();
  const employeeId = formId(form, "employeeId");
  const kind = SALARY_KINDS.find((k) => k === form.get("kind"));
  const date = formDate(form);
  const month = formMonth(form);
  const amount = formAmount(form);
  if (!employeeId || !kind || !date || !month || !amount) return;
  if (!db.select().from(schema.employees).where(and(eq(schema.employees.id, employeeId), eq(schema.employees.shopId, shop.id))).get()) return;
  db.insert(schema.salaryPayments)
    .values({ employeeId, kind, date, month, amount, note: formText(form, "note") })
    .run();
  revalidate();
}

export async function deleteSalaryPayment(id: number) {
  const { shop } = await requireOwnerShop();
  const payment = db
    .select({ id: schema.salaryPayments.id })
    .from(schema.salaryPayments)
    .innerJoin(schema.employees, eq(schema.employees.id, schema.salaryPayments.employeeId))
    .where(and(eq(schema.salaryPayments.id, id), eq(schema.employees.shopId, shop.id)))
    .get();
  if (!payment) return;
  db.delete(schema.salaryPayments).where(eq(schema.salaryPayments.id, id)).run();
  revalidate();
}
