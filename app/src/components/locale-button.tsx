import { toggleLocale } from "@/app/actions";

export function LocaleButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <form action={toggleLocale}>
      <button className={`text-sm font-medium text-muted underline-offset-4 hover:text-cocoa hover:underline ${className}`}>
        {label}
      </button>
    </form>
  );
}
