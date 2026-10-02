import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { PageHeader } from "@/components/ui";
import { requireOwner } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { setActive } from "./actions";
import { NewUserForm, ResetPasswordForm } from "./user-forms";

export default async function UsersPage() {
  const me = await requireOwner();
  const { t } = await getDict();
  const users = db.select().from(schema.users).orderBy(asc(schema.users.name)).all();
  const ft = { users: t.users, common: t.common, errors: t.errors };

  return (
    <>
      <PageHeader title={t.users.title} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <ul className="card divide-y divide-line self-start overflow-hidden">
          {users.map((u) => (
            <li key={u.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${u.active ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {u.name}
                  {u.id === me.id && <span className="text-muted"> ({t.users.you})</span>}
                </div>
                <div className="text-xs text-muted">
                  <span dir="ltr">@{u.username}</span> · {u.role === "owner" ? t.users.owner : t.users.staff}
                  {!u.active && ` · ${t.common.inactive}`}
                </div>
              </div>
              <ResetPasswordForm t={ft} userId={u.id} />
              {u.id !== me.id && (
                <form action={setActive.bind(null, u.id, !u.active)}>
                  <button className={`text-sm font-medium ${u.active ? "text-bad" : "text-ok"}`}>
                    {u.active ? t.users.deactivate : t.users.activate}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <NewUserForm t={ft} />
      </div>
    </>
  );
}
