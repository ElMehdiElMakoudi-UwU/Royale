import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { LocaleButton } from "@/components/locale-button";
import { navItems } from "@/components/nav-items";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDict } from "@/lib/i18n";

/** Phone-only menu for the sections that don't fit in the bottom bar. */
export default async function MorePage() {
  const user = await requireUser();
  const { t } = await getDict();
  const hidden = navItems(user, t).filter((i) => i.mobile === false);

  return (
    <>
      <PageHeader title={t.nav.more} subtitle={user.name} />
      <ul className="card mb-6 divide-y divide-line overflow-hidden">
        {hidden.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex items-center justify-between px-4 py-3.5 font-medium hover:bg-cream">
              {i.label}
              <span className="text-muted rtl:rotate-180">→</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between px-1">
        <LocaleButton label={t.common.language} />
        <form action={logoutAction}>
          <button className="text-sm font-medium text-bad">{t.common.logout}</button>
        </form>
      </div>
    </>
  );
}
