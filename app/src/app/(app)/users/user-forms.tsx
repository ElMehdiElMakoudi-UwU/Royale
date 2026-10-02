"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { Dict } from "@/lib/i18n/fr";
import { createUser, resetPassword } from "./actions";

type T = Pick<Dict, "users" | "common" | "errors">;

function ErrorText({ t, error }: { t: T; error?: string }) {
  if (!error) return null;
  const msg = error === "usernameTaken" ? t.users.usernameTaken : t.errors[error as "required" | "invalid"];
  return <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{msg}</p>;
}

export function NewUserForm({ t }: { t: T }) {
  const [state, action, pending] = useActionState(createUser, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="card space-y-4 p-5">
      <h2 className="font-semibold text-cocoa">{t.users.new}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">{t.users.name}</label>
          <input id="name" name="name" className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="username">{t.users.username}</label>
          <input id="username" name="username" dir="ltr" className="field" autoCapitalize="none" autoComplete="off" required />
        </div>
        <div>
          <label className="label" htmlFor="password">{t.users.password}</label>
          <input id="password" name="password" dir="ltr" className="field" autoComplete="new-password" minLength={6} required />
          <p className="mt-1 text-xs text-muted">{t.users.passwordHint}</p>
        </div>
        <div>
          <label className="label" htmlFor="role">{t.users.role}</label>
          <select id="role" name="role" className="field" defaultValue="staff">
            <option value="staff">{t.users.staff}</option>
            <option value="owner">{t.users.owner}</option>
          </select>
        </div>
      </div>
      <ErrorText t={t} error={state.error} />
      {state.ok && <p className="text-sm text-ok">{t.common.saved}</p>}
      <button className="btn-primary" disabled={pending}>{t.users.new}</button>
    </form>
  );
}

export function ResetPasswordForm({ t, userId }: { t: T; userId: number }) {
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const [state, action, pending] = useActionState(resetPassword.bind(null, userId), {});
  // Remember the last success at opening time; a newer success closes the form.
  const open = openedAt != null && (state.ok ?? 0) === openedAt;

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <button onClick={() => setOpenedAt(state.ok ?? 0)} className="text-sm font-medium text-cocoa underline-offset-4 hover:underline">
          {t.users.resetPassword}
        </button>
        {state.ok && <span className="text-xs text-ok">{t.common.saved}</span>}
      </span>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input
        name="password"
        dir="ltr"
        placeholder={t.users.newPassword}
        minLength={6}
        required
        autoFocus
        autoComplete="new-password"
        className="field h-9 w-44 py-1 text-sm"
      />
      <button className="btn-primary h-9 px-3" disabled={pending}>{t.common.save}</button>
      <button type="button" onClick={() => setOpenedAt(null)} className="text-sm text-muted">{t.common.cancel}</button>
      {state.error && <span className="text-xs text-bad">{t.users.passwordHint}</span>}
    </form>
  );
}
