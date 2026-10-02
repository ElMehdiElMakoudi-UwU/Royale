import type { User } from "@/db/schema";
import type { Dict } from "@/lib/i18n/fr";
import type { NavItem } from "./nav";

/** Sections the user can open; `mobile`/`desktop: false` ones live under "Plus" on that screen size. */
export function navItems(user: User, t: Dict): NavItem[] {
  if (user.role !== "owner") {
    return [
      { href: "/", key: "home", label: t.nav.home },
      { href: "/pos", key: "pos", label: t.nav.pos },
      { href: "/counts", key: "counts", label: t.nav.counts },
      { href: "/cash", key: "cash", label: t.nav.cash },
      { href: "/tickets", key: "tickets", label: t.nav.tickets, mobile: false },
    ];
  }
  return [
    { href: "/", key: "home", label: t.nav.home },
    { href: "/pos", key: "pos", label: t.nav.pos, mobile: false },
    { href: "/counts", key: "counts", label: t.nav.counts, mobile: false },
    { href: "/cash", key: "cash", label: t.nav.cash },
    { href: "/sales", key: "sales", label: t.nav.sales },
    { href: "/deliveries", key: "deliveries", label: t.nav.deliveries },
    { href: "/factory", key: "factory", label: t.nav.factory, mobile: false },
    { href: "/expenses", key: "expenses", label: t.nav.expenses, mobile: false },
    { href: "/salaries", key: "salaries", label: t.nav.salaries, mobile: false, desktop: false },
    { href: "/report", key: "report", label: t.nav.report, mobile: false },
    { href: "/products", key: "products", label: t.nav.products, mobile: false, desktop: false },
    { href: "/tickets", key: "tickets", label: t.nav.tickets, mobile: false, desktop: false },
    { href: "/users", key: "users", label: t.nav.users, mobile: false, desktop: false },
    { href: "/settings", key: "settings", label: t.nav.settings, mobile: false, desktop: false },
  ];
}
