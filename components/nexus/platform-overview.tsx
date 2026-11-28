"use client";

import { Activity, RefreshCw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import type { TimeseriesPoint } from "@/lib/api/revenue";
import { formatShortDate } from "@/lib/format";
import { Ring } from "@/components/intelligence/visuals";

type Health = AdminResourcePayloads["serviceHealth"];

// Same order of magnitude on purpose: a shared axis only stays readable when
// one series cannot flatten the others. Daily active accounts are an order of
// magnitude larger and live on User intelligence instead.
const SERIES_DEFS = [
  { key: "deals_agreed", label: "Deals agreed", color: "#947bff", hint: "Deals agreed per UTC day." },
  { key: "signups", label: "Sign-ups", color: "#55ddf2", hint: "New accounts created per UTC day." },
  { key: "listings_created", label: "New listings", color: "#38d9a5", hint: "Listings created per UTC day." },
] as const;

type SeriesKey = (typeof SERIES_DEFS)[number]["key"];

function hasData(points: TimeseriesPoint[] | undefined): points is TimeseriesPoint[] {
  return Boolean(points?.some((point) => point.v !== null));
}

function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function NexusPlatformOverview({
  series,
  windowDays,
  onWindowChange,
  isLoading,
  isError,
  error,
  onRetry,
  health,
  generatedAt,
}: {
  series?: Record<string, TimeseriesPoint[]>;
  windowDays: number;
  onWindowChange: (days: number) => void;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  health?: Health;
  generatedAt?: string | null;
}) {
  const available = SERIES_DEFS.filter((definition) => hasData(series?.[definition.key]));
  const [hidden, setHidden] = useState<SeriesKey[]>([]);
  const visible = available.filter((definition) => !hidden.includes(definition.key));

  // One row per date across every series, so the lines share an x axis and a
  // missing bucket stays a gap rather than a zero.
  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string | null>>();
    for (const definition of SERIES_DEFS) {
      for (const point of series?.[definition.key] ?? []) {
        const row = byDate.get(point.t) ?? { t: point.t };
        row[definition.key] = point.v;
        byDate.set(point.t, row);
      }
    }
    return Array.from(byDate.values()).sort((a, b) => String(a.t).localeCompare(String(b.t)));
  }, [series]);

  const checkSummary = useMemo(() => {
    if (!health) return null;
    const total = health.checks.length;
    const ok = health.checks.filter((check) => check.status === "ok").length;
    const degraded = health.checks.filter((check) => check.status === "degraded" || check.status === "warning").length;
    const failed = health.checks.filter((check) => check.status === "error" || check.status === "down").length;
    return { total, ok, degraded, failed, ratio: total ? (ok / total) * 100 : null };
  }, [health]);

  const summary = visible.length
    ? `${visible.map((definition) => definition.label).join(", ")} over the last ${windowDays} days. Gaps are days the backend did not measure.`
    : "No measured series for this window.";

  return (
    <section className="nx-panel p-4 sm:p-5" aria-labelledby="nexus-platform-title">
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#947bff]/35 bg-[#947bff]/12 text-[#c9beff]" aria-hidden="true"><Activity size={14} /></span>
            <h2 id="nexus-platform-title" className="font-display text-[15px] font-bold tracking-[-0.02em] text-white">Platform analytics</h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {isLoading ? "Reading the server-computed series…" : "Per-day measured activity, sign-ups and supply. Missing days stay missing."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label="Analytics window" className="inline-flex rounded-lg border border-white/[0.09] bg-black/25 p-0.5">
            {[7, 30].map((days) => (
              <button
                key={days}
                type="button"
                role="radio"
                aria-checked={windowDays === days}
                onClick={() => onWindowChange(days)}
                className={cn(
                  "focus-ring rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                  windowDays === days ? "bg-[#947bff]/25 text-[#efeaff] shadow-[inset_0_0_0_1px_rgba(148,123,255,0.45)]" : "text-slate-500 hover:text-slate-200",
                )}
              >
                {days}d
              </button>
            ))}
          </div>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white" aria-label="Refresh analytics">
              <RefreshCw size={11} aria-hidden="true" /> Refresh
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Toggle chart series">
        {available.length ? available.map((definition) => {
          const active = !hidden.includes(definition.key);
          return (
            <button
              key={definition.key}
              type="button"
              aria-pressed={active}
              onClick={() => setHidden((current) => (active ? [...current, definition.key] : current.filter((key) => key !== definition.key)))}
              className={cn(
                "focus-ring inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition",
                active ? "border-white/[0.14] bg-white/[0.05] text-slate-100" : "border-white/[0.07] text-slate-500",
              )}
              title={definition.hint}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? definition.color : "#475569", boxShadow: active ? `0 0 8px ${definition.color}` : "none" }} aria-hidden="true" />
              {definition.label}
            </button>
          );
        }) : null}
      </div>

      <div className="relative mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_150px] xl:items-center">
        <div className="min-w-0">
          {isLoading ? (
            <div className="h-[268px] space-y-2" aria-busy="true">
              <div className="skeleton h-[228px]" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ) : isError ? (
            <div className="grid h-[268px] place-items-center rounded-xl border border-dashed border-rose-400/25 bg-rose-400/[0.04] px-4 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-100">The analytics series could not be loaded</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-slate-400">{error instanceof Error ? error.message : "The backend did not return the timeseries response."} No value on this page is derived from it.</p>
              </div>
            </div>
          ) : !available.length ? (
            <div className="grid h-[268px] place-items-center rounded-xl border border-dashed border-white/10 bg-black/15 px-4 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-200">No measured series for the last {windowDays} days</p>
                <p className="mx-auto mt-1 max-w-md text-[11px] leading-5 text-slate-500">The endpoint returned no measured buckets in this window. A gap is shown here; it is not the same as zero activity.</p>
              </div>
            </div>
          ) : (
            <div className="h-[268px]" role="img" aria-label={summary} data-testid="nexus-platform-chart">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    {SERIES_DEFS.map((definition) => (
                      <linearGradient key={definition.key} id={`nx-area-${definition.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={definition.color} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={definition.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke="rgba(190,203,232,0.08)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    tickFormatter={(value: string) => formatShortDate(value)}
                    tick={{ fill: "#8491ac", fontSize: 10 }}
                    axisLine={{ stroke: "rgba(190,203,232,0.14)" }}
                    tickLine={false}
                    minTickGap={26}
                  />
                  <YAxis
                    domain={[(min: number) => Math.max(0, Math.floor(min * 0.85)), "auto"]}
                    tickFormatter={(value: number) => compactNumber(value)}
                    tick={{ fill: "#8491ac", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatShortDate(String(value))}
                    formatter={(value, name) => {
                      const definition = SERIES_DEFS.find((entry) => entry.key === name);
                      return [Number(value).toLocaleString("en-KE"), definition?.label ?? String(name)];
                    }}
                    contentStyle={{
                      background: "#0d1424",
                      border: "1px solid rgba(190,203,232,0.18)",
                      borderRadius: 10,
                      fontSize: 11,
                      color: "#f5f7ff",
                      boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
                    }}
                    itemStyle={{ color: "#e6e2ff" }}
                  />
                  {visible.map((definition) => (
                    <Area
                      key={definition.key}
                      type="monotone"
                      dataKey={definition.key}
                      name={definition.key}
                      stroke={definition.color}
                      strokeWidth={2.2}
                      fill={`url(#nx-area-${definition.key})`}
                      dot={false}
                      activeDot={{ r: 3.5, fill: definition.color, stroke: "#0d1424", strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9.5px] text-slate-600">
            <span>{available.length} of {SERIES_DEFS.length} series measured</span>
            <span aria-hidden="true">·</span>
            <span>GET /admin/analytics/timeseries</span>
            {generatedAt ? <><span aria-hidden="true">·</span><span>window ends {formatShortDate(generatedAt)}</span></> : null}
          </p>
        </div>

        <div className="nx-inset flex items-center gap-3 p-3 xl:flex-col xl:text-center">
          <Ring
            value={checkSummary?.ratio ?? null}
            size={96}
            stroke={8}
            label="Service checks passing"
            caption={<span className="block text-[9px] uppercase tracking-[0.14em] text-slate-500">Checks<br />passing</span>}
            from="#947bff"
            to="#38d9a5"
          />
          <div className="min-w-0 space-y-1 text-left xl:text-center">
            <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-slate-200 xl:justify-center"><ShieldCheck size={11} className="text-emerald-300" aria-hidden="true" /> Service checks</p>
            {checkSummary ? (
              <p className="text-[9.5px] leading-4 text-slate-500">
                {checkSummary.ok} of {checkSummary.total} healthy
                {checkSummary.degraded ? ` · ${checkSummary.degraded} degraded` : ""}
                {checkSummary.failed ? ` · ${checkSummary.failed} failing` : ""}
              </p>
            ) : (
              <p className="text-[9.5px] leading-4 text-slate-500">Health probe not returned</p>
            )}
            {health?.providers?.length ? <p className="text-[9px] leading-4 text-slate-600">{health.providers.length} providers configured, not probed</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
