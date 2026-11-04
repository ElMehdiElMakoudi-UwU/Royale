"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { switchShop } from "@/app/actions";
import { SHOP_COOKIE } from "@/lib/shop-cookie";

/**
 * Lets the owner change shop. A page for one record (/counts/12) belongs to the old shop,
 * so switching lands on its section (/counts).
 */
export function ShopSwitcher({ shops, current, label }: { shops: { id: number; name: string }[]; current: number; label: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();

  // A tab left open on the other shop must not save into the new one: refresh it on return.
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== "visible") return;
      const cookie = document.cookie.split("; ").find((c) => c.startsWith(`${SHOP_COOKIE}=`))?.split("=")[1];
      if (cookie && Number(cookie) !== current) {
        router.push(`/${window.location.pathname.split("/")[1]}`);
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [current, router]);

  return (
    <select
      aria-label={label}
      value={current}
      disabled={pending}
      onChange={(e) => {
        const id = Number(e.target.value);
        start(() => switchShop(id, `/${pathname.split("/")[1]}`));
      }}
      className="h-9 max-w-32 rounded-lg border border-line bg-gold-soft px-2 text-sm font-semibold text-cocoa"
    >
      {shops.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </select>
  );
}
