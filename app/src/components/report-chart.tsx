"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";

/** Each shop keeps its colour whatever the chart; validated for colour-blind separation on white. */
const SERIES_COLORS = ["#a8552a", "#007f9f", "#b8893d"];
const seriesColor = (slot: number) => SERIES_COLORS[slot % SERIES_COLORS.length];

export type ChartSeries = { name: string; slot: number; values: (number | null)[] };

type Props = {
  kind: "line" | "bars";
  title: string;
  hint?: string;
  /** Under the axis, one per point. */
  labels: string[];
  /** Tooltip and table heading, one per point. */
  titles: string[];
  series: ChartSeries[];
  dh: string;
  tableLabel: string;
};

const HEIGHT = 220;
const MARGIN = { top: 12, right: 12, bottom: 26, left: 48 };

/** Round axis bounds and ticks; values are centimes, ticks fall on whole dirhams. */
function axisScale(values: number[]) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  if (lo === hi) return { min: 0, max: 100000, ticks: [0, 50000, 100000] };
  const raw = (hi - lo) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw)!;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(t);
  return { min, max, ticks };
}

function axisLabel(centimes: number, compact: boolean) {
  const dh = centimes / 100;
  return compact ? `${(dh / 1000).toLocaleString("fr-FR")} k` : dh.toLocaleString("fr-FR");
}

/** Column with a rounded data end and a square foot on the baseline; downward when negative. */
function barPath(x: number, width: number, base: number, end: number) {
  const up = end < base;
  const r = Math.min(4, width / 2, Math.abs(base - end));
  const y = up ? end + r : end - r;
  const sweep = up ? 1 : 0;
  return `M${x},${base}V${y}A${r},${r} 0 0 ${sweep} ${x + r},${end}H${x + width - r}A${r},${r} 0 0 ${sweep} ${x + width},${y}V${base}Z`;
}

/** Straight segments between consecutive points; a day without a figure breaks the line. */
function linePath(points: ({ x: number; y: number } | null)[]) {
  let path = "";
  let drawing = false;
  for (const p of points) {
    if (!p) {
      drawing = false;
      continue;
    }
    path += `${drawing ? "L" : "M"}${p.x},${p.y}`;
    drawing = true;
  }
  return path;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  // 0 until measured: drawing at a guessed width would overflow narrow screens before hydration.
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function ReportChart({ kind, title, hint, labels, titles, series, dh, tableLabel }: Props) {
  const { ref, width } = useWidth();
  const [active, setActive] = useState<number | null>(null);

  const count = labels.length;
  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = plotWidth / count;
  const center = (i: number) => MARGIN.left + band * (i + 0.5);

  const { min, max, ticks } = axisScale(series.flatMap((s) => s.values.filter((v): v is number => v != null)));
  const y = (v: number) => MARGIN.top + ((max - v) / (max - min)) * plotHeight;
  const compact = Math.max(Math.abs(min), Math.abs(max)) >= 1_000_000;

  // Keep axis labels from colliding: every label when they fit, otherwise every nth.
  const labelWidth = Math.max(...labels.map((l) => l.length)) * 7 + 8;
  const labelEvery = Math.max(1, Math.ceil(labelWidth / band));

  const pointAt = (clientX: number, element: Element) => {
    const offset = clientX - element.getBoundingClientRect().left - MARGIN.left;
    return Math.min(count - 1, Math.max(0, Math.floor(offset / band)));
  };

  const groupGap = 2;
  const barWidth = Math.max(2, Math.min(24, (band * 0.8 - groupGap * (series.length - 1)) / series.length));
  const groupWidth = barWidth * series.length + groupGap * (series.length - 1);

  return (
    <figure className="card min-w-0 p-4">
      <figcaption className="mb-3">
        <div className="font-semibold text-cocoa">{title}</div>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        {series.length > 1 && (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {series.map((s) => (
              <li key={s.name} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ background: seriesColor(s.slot) }} />
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </figcaption>

      {/* Time and bars read left to right in Arabic too, like the numbers. */}
      {/* The SVG is out of flow so its width can't hold the box open: the box sets the width, never the reverse. */}
      <div ref={ref} dir="ltr" className="relative" style={{ height: HEIGHT }}>
        {width > 0 && <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={title}
          tabIndex={0}
          className="absolute inset-0 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          onPointerMove={(e) => setActive(pointAt(e.clientX, e.currentTarget))}
          onPointerDown={(e) => setActive(pointAt(e.clientX, e.currentTarget))}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const step = e.key === "ArrowRight" ? 1 : -1;
            setActive((i) => Math.min(count - 1, Math.max(0, (i ?? (step > 0 ? -1 : count)) + step)));
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-muted)" className="tabular">
                {axisLabel(t, compact)}
              </text>
            </g>
          ))}

          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={center(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)" className="tabular">
                {l}
              </text>
            ) : null,
          )}

          {active != null &&
            (kind === "line" ? (
              <line x1={center(active)} x2={center(active)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--color-muted)" />
            ) : (
              <rect x={MARGIN.left + band * active} y={MARGIN.top} width={band} height={plotHeight} fill="var(--color-cream)" />
            ))}

          {kind === "bars"
            ? series.map((s, si) =>
                s.values.map((v, i) =>
                  v == null || v === 0 ? null : (
                    <path
                      key={`${s.name}-${i}`}
                      d={barPath(center(i) - groupWidth / 2 + si * (barWidth + groupGap), barWidth, y(0), y(v))}
                      fill={seriesColor(s.slot)}
                    />
                  ),
                ),
              )
            : series.map((s) => {
                const points = s.values.map((v, i) => (v == null ? null : { x: center(i), y: y(v) }));
                return (
                  <g key={s.name}>
                    <path d={linePath(points)} fill="none" stroke={seriesColor(s.slot)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((p, i) => {
                      // A lone day has no segment to show it; the hovered day gets a marker too.
                      const isolated = p && !points[i - 1] && !points[i + 1];
                      return p && (isolated || i === active) ? (
                        <circle key={i} cx={p.x} cy={p.y} r={4} fill={seriesColor(s.slot)} stroke="var(--color-paper)" strokeWidth={2} />
                      ) : null;
                    })}
                  </g>
                );
              })}
        </svg>}

        {active != null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-sm"
            style={
              // Too narrow to sit beside the crosshair: span the plot instead of running off the edge.
              width < 480
                ? { left: MARGIN.left, right: MARGIN.right }
                : center(active) > width / 2
                  ? { right: width - center(active) + 10, width: "max-content" }
                  : { left: center(active) + 10, width: "max-content" }
            }
          >
            <div className="mb-1 font-semibold capitalize text-cocoa">{titles[active]}</div>
            {series.map((s) => (
              <div key={s.name} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-full" style={{ background: seriesColor(s.slot) }} />
                  {s.name}
                </span>
                <span className="tabular font-medium">{s.values[active] == null ? "—" : `${money(s.values[active])} ${dh}`}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-muted hover:text-cocoa">{tableLabel}</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="tabular w-full">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th />
                {series.map((s) => (
                  <th key={s.name} className="px-2 py-1 text-end font-medium">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {titles.map((rowTitle, i) => (
                <tr key={rowTitle}>
                  <td className="py-1 pe-2 capitalize">{rowTitle}</td>
                  {series.map((s) => (
                    <td key={s.name} className="whitespace-nowrap px-2 py-1 text-end">{money(s.values[i])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
