"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import type { Dict } from "@/lib/i18n/fr";

export function LoginForm({ t }: { t: Dict["login"] }) {
  const [state, action, pending] = useActionState(loginAction, { error: false });
  return (
    <form action={action} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="username">{t.username}</label>
        <input
          id="username"
          name="username"
          className="field"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">{t.password}</label>
        <input
          id="password"
          name="password"
          type="password"
          className="field"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{t.invalid}</p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {t.submit}
      </button>
    </form>
  );
}
