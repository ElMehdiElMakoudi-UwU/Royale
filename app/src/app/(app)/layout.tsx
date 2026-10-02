import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { LocaleButton } from "@/components/locale-button";
import { BottomNav, TopNav } from "@/components/nav";
import { navItems } from "@/components/nav-items";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getDict();

  const items = navItems(user, t);

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-cocoa font-display text-lg text-gold-soft">R</span>
            <span className="font-display text-xl text-cocoa">{t.appName}</span>
          </Link>
          <TopNav items={items} moreLabel={t.nav.more} />
          <div className="ms-auto flex items-center gap-4">
            <span className="hidden text-sm text-muted xl:inline">{user.name}</span>
            <LocaleButton label={t.common.language} />
            <form action={logoutAction}>
              <button className="text-sm font-medium text-muted hover:text-bad">{t.common.logout}</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <BottomNav items={items} moreLabel={t.nav.more} />
    </div>
  );
}
