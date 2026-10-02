"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { SALARY_KINDS } from "@/db/schema";
import { requireOwner } from "@/lib/auth";
import { formAmount, formDate, formId, formMonth, formText } from "@/lib/form";

function revalidate() {
  revalidatePath("/salaries");
  revalidatePath("/report");
}

export async function addEmployee(form: FormData) {
  await requireOwner();
  const name = formText(form, "name", 100);
  const monthlySalary = formAmount(form, "monthlySalary");
  if (!name || !monthlySalary) return;
  db.insert(schema.employees).values({ name, monthlySalary }).run();
  revalidate();
}

export async function updateSalary(id: number, form: FormData) {
  await requireOwner();
  const monthlySalary = formAmount(form, "monthlySalary");
  if (!monthlySalary) return;
  db.update(schema.employees).set({ monthlySalary }).where(eq(schema.employees.id, id)).run();
  revalidate();
}

export async function setEmployeeActive(id: number, active: boolean) {
  await requireOwner();
  db.update(schema.employees).set({ active }).where(eq(schema.employees.id, id)).run();
  revalidate();
}

export async function addSalaryPayment(form: FormData) {
  await requireOwner();
  const employeeId = formId(form, "employeeId");
  const kind = SALARY_KINDS.find((k) => k === form.get("kind"));
  const date = formDate(form);
  const month = formMonth(form);
  const amount = formAmount(form);
  if (!employeeId || !kind || !date || !month || !amount) return;
  if (!db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).get()) return;
  db.insert(schema.salaryPayments)
    .values({ employeeId, kind, date, month, amount, note: formText(form, "note") })
    .run();
  revalidate();
}

export async function deleteSalaryPayment(id: number) {
  await requireOwner();
  db.delete(schema.salaryPayments).where(eq(schema.salaryPayments.id, id)).run();
  revalidate();
}
