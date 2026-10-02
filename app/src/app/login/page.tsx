import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";
import { LocaleButton } from "@/components/locale-button";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  const { t } = await getDict();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-cocoa font-display text-3xl text-gold-soft">
            R
          </div>
          <h1 className="font-display text-3xl text-cocoa">{t.appName}</h1>
          <p className="mt-1 text-sm text-muted">{t.login.title}</p>
        </div>
        <LoginForm t={t.login} />
        <div className="mt-6 text-center">
          <LocaleButton label={t.common.language} />
        </div>
      </div>
    </main>
  );
}
