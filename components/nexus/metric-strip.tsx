"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Handshake,
  Minus,
  PackageOpen,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import type { CommandCenter, CommandMetric } from "@/lib/api/schemas";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import type { TimeseriesPoint } from "@/lib/api/revenue";
import { formatMetricValue, metricTrend } from "@/lib/command-center";
import { formatKesAmount } from "@/lib/format";

type Summary = AdminResourcePayloads["summary"];

type Accent = "violet" | "cyan" | "emerald" | "amber";

const ACCENT_CLASS: Record<Accent, string> = {
  violet: "text-[#c9beff] [--nx-accent:var(--nexus-violet)] [--nx-accent-rgb:var(--nexus-violet-rgb)]",
  cyan: "text-[#8fe6f5] [--nx-accent:var(--nexus-cyan)] [--nx-accent-rgb:var(--nexus-cyan-rgb)]",
  emerald: "text-emerald-300 [--nx-accent:var(--nexus-emerald)] [--nx-accent-rgb:56_217_165]",
  amber: "text-amber-200 [--nx-accent:var(--nexus-amber)] [--nx-accent-rgb:231_189_104]",
};

const ACCENT_STROKE: Record<Accent, string> = {
  violet: "#a793ff",
  cyan: "#55ddf2",
  emerald: "#38d9a5",
  amber: "#e7bd68",
};

const TILE_SPECS: Array<{
  id: string;
  label: string;
  keys: string[];
  href: string;
  icon: typeof Users;
  accent: Accent;
  series?: string;
  summaryValue?: (summary: Summary) => string | undefined;
  summaryCaption: string;
}> = [
  {
    id: "users",
    label: "Total users",
    keys: ["registered_users", "total_users", "users"],
    href: "/users",
    icon: Users,
    accent: "violet",
    series: "signups",
    summaryValue: (summary) => summary.users.toLocaleString("en-KE"),
    summaryCaption: "Verified user rows",
  },
  {
    id: "listings",
    label: "Listings",
    keys: ["live_listings", "total_listings", "listings"],
    href: "/listings",
    icon: PackageOpen,
    accent: "cyan",
    series: "listings_created",
    summaryValue: (summary) => (summary.listings_active ?? summary.listings).toLocaleString("en-KE"),
    summaryCaption: "Verified listing rows",
  },
  {
    id: "deals",
    label: "Deals agreed",
    keys: ["deals_agreed", "deals_released", "deals"],
    href: "/deals",
    icon: Handshake,
    accent: "amber",
    series: "deals_agreed",
    summaryValue: (summary) => summary.deals.toLocaleString("en-KE"),
    summaryCaption: "Verified deal rows",
  },
  {
    id: "revenue",
    label: "Commission",
    keys: ["revenue", "commission_recognised", "commission"],
    href: "/revenue",
    icon: Wallet,
    accent: "emerald",
    series: "gmv_minor",
    summaryValue: (summary) => formatKesAmount(summary.commission_earned_kes),
    summaryCaption: "Released deals · not bank cash",
  },
];

function findMetric(command: CommandCenter | undefined, keys: string[]): CommandMetric | undefined {
  if (!command) return undefined;
  const metrics = command.groups.flatMap((group) => group.metrics);
  for (const key of keys) {
    const match = metrics.find((metric) => metric.key === key);
    if (match) return match;
  }
  return undefined;
}

/** Real series only: null buckets break the path, they are never drawn as zero. */
function Spark({ points, tone, label }: { points?: TimeseriesPoint[]; tone: string; label: string }) {
  const measured = useMemo(() => (points ?? []).filter((point): point is { t: string; v: number } => point.v !== null), [points]);
  if (measured.length < 2) {
    return (
      <div className="mt-2 flex h-[34px] items-end rounded-md border border-dashed border-white/[0.07] px-2 pb-1" aria-hidden="true">
        <span className="text-[8.5px] uppercase tracking-[0.14em] text-slate-600">No series for this window</span>
      </div>
    );
  }
  const values = measured.map((point) => point.v);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const width = 100;
  const height = 34;
  const path = measured
    .map((point, index) => {
      const x = (index / (measured.length - 1)) * width;
      const y = height - ((point.v - min) / span) * (height - 6) - 3;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const last = measured[measured.length - 1];
  const lastY = height - ((last.v - min) / span) * (height - 6) - 3;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="nx-metric__spark w-full" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`spark-${tone.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.38} />
          <stop offset="100%" stopColor={tone} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#spark-${tone.replace("#", "")})`} />
      <path d={path} fill="none" stroke={tone} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="1.8" fill={tone} />
    </svg>
  );
}

function Trend({ metric }: { metric?: CommandMetric }) {
  if (!metric) return <span className="text-[10px] text-slate-600">No comparison returned</span>;
  const trend = metricTrend(metric);
  const Icon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const tone = trend.tone === "good" ? "text-emerald-300" : trend.tone === "bad" ? "text-rose-300" : "text-slate-400";
  const previous = metric.previous !== null ? ` · prev ${formatMetricValue(metric.unit, metric.previous)}` : "";
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums", tone)} title={`${metric.definition}${previous}`}>
      {trend.direction !== "none" ? <Icon size={12} aria-hidden="true" /> : null}
      {trend.text}
      <span className="sr-only">{` compared with the previous period${previous}`}</span>
    </span>
  );
}

/**
 * The four headline figures. Every value comes from the command-center contract
 * or the verified admin summary; the sparkline is the measured series for the
 * same window. When a figure is not served, the card says so instead of
 * showing a plausible number.
 */
export function NexusMetricStrip({
  command,
  summary,
  series,
  windowDays,
}: {
  command?: CommandCenter;
  summary?: Summary;
  series?: Record<string, TimeseriesPoint[]>;
  windowDays: number;
}) {
  return (
    <section aria-label="Headline platform figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {TILE_SPECS.map((spec) => {
        const metric = findMetric(command, spec.keys);
        const fallback = summary ? spec.summaryValue?.(summary) : undefined;
        const value = metric?.available ? formatMetricValue(metric.unit, metric.value) : fallback ?? "—";
        const caption = metric
          ? metric.available
            ? metric.caption ?? `${windowDays}-day window`
            : metric.unavailable_reason ?? "Not measured by the backend"
          : fallback
            ? `${spec.summaryCaption} · comparison unavailable`
            : "Waiting for a verified response";
        const Icon = spec.icon;
        const body = (
          <>
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{spec.label}</p>
                <p className="nx-metric__value mt-2">{value}</p>
              </div>
              <span className={cn("nx-metric__icon", ACCENT_CLASS[spec.accent])} aria-hidden="true"><Icon size={16} /></span>
            </div>
            <div className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Trend metric={metric} />
            </div>
            <Spark points={spec.series ? series?.[spec.series] : undefined} tone={ACCENT_STROKE[spec.accent]} label={`${spec.label} measured series for the last ${windowDays} days`} />
            <p className="relative mt-1 truncate text-[9.5px] text-slate-600" title={caption}>{caption}</p>
          </>
        );
        return (
          <Link
            key={spec.id}
            href={spec.href}
            className={cn("nx-metric focus-ring min-h-[148px]", ACCENT_CLASS[spec.accent])}
            aria-label={`${spec.label}: ${value}. Open the workspace.`}
          >
            {body}
          </Link>
        );
      })}
    </section>
  );
}
