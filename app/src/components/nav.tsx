"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  counts: (
    <>
      <path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Z" />
      <path d="M8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  deliveries: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 9h6M9 13h6M9 17h3" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6.5 9.5v5M17.5 9.5v5" />
    </>
  ),
  pos: (
    <>
      <path d="M4 4h16v10H4z" />
      <path d="M8 18h8M12 14v4M7 8h4" />
    </>
  ),
  orders: (
    <>
      <path d="M4 20h16M5 20v-6h14v6" />
      <path d="M7 14v-3h10v3" />
      <path d="M12 11V8M12 5.5v.01" />
    </>
  ),
  tickets: (
    <>
      <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z" />
      <path d="M9 8h6M9 12h4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),
  sales: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  factory: (
    <>
      <path d="M3 21V10l5 3V10l5 3V7l8 4v10z" />
      <path d="M7 17h2M12 17h2M17 17h2" />
    </>
  ),
  expenses: (
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  salaries: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  report: (
    <>
      <path d="M4 4v16h16" />
      <path d="m8 14 3-3 3 2 5-6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </>
  ),
  products: (
    <>
      <path d="M4 10h16l-1.5 10H5.5z" />
      <path d="M8 10a4 4 0 1 1 8 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
    </>
  ),
};

export type NavItem = { href: string; key: keyof typeof icons | string; label: string; mobile?: boolean; desktop?: boolean };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
}

export function TopNav({ items: all, moreLabel }: { items: NavItem[]; moreLabel: string }) {
  const pathname = usePathname();
  const items = all.filter((i) => i.desktop !== false);
  if (items.length < all.length) items.push({ href: "/more", key: "more", label: moreLabel });
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
            isActive(pathname, item.href) ? "bg-gold-soft text-cocoa" : "text-muted hover:text-cocoa"
          }`}
        >
          <Icon name={item.key} />
          {isActive(pathname, item.href) && <span className="hidden lg:inline">{item.label}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ items: all, moreLabel }: { items: NavItem[]; moreLabel: string }) {
  const pathname = usePathname();
  const hidden = all.filter((i) => i.mobile === false);
  const items = all.filter((i) => i.mobile !== false);
  if (hidden.length > 0) {
    items.push({ href: "/more", key: "more", label: moreLabel });
  }
  const activeHidden = hidden.some((i) => isActive(pathname, i.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(pathname, item.href) || (item.href === "/more" && activeHidden);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? "text-cocoa" : "text-muted"
              }`}
            >
              <Icon name={item.key} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
