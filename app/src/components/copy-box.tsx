"use client";

import { useState } from "react";

export function CopyBox({ text, labels }: { text: string; labels: { copy: string; copied: string } }) {
  const [value, setValue] = useState(text);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div>
      <textarea
        dir="ltr"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={Math.min(14, value.split("\n").length + 1)}
        className="field font-mono text-sm"
      />
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={copy} className="btn-ghost">
          {copied ? `✓ ${labels.copied}` : labels.copy}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(value)}`} target="_blank" rel="noreferrer" className="btn-ghost">
          WhatsApp
        </a>
      </div>
    </div>
  );
}
