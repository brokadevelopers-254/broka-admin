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
import { useId, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { CommandCenter, CommandMetric } from "@/lib/api/schemas";
import type { AdminResourcePayloads } from "@/lib/api/schemas";
import type { TimeseriesPoint } from "@/lib/api/revenue";
import { formatMetricValue, metricTrend } from "@/lib/command-center";
import { formatKesAmount } from "@/lib/format";

type Summary = AdminResourcePayloads["summary"];

type Accent = "violet" | "cyan" | "emerald" | "amber";

type MetricKey = { group: string; key: string };

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

/**
 * Each tile names one measure and only ever charts that same measure.
 *
 * `level` metrics (total users, live listings, platform revenue) are point-in-
 * time balances. Their spark is a clearly-labelled *flow* series, never the
 * balance drawn as if it were daily movement — and where the backend serves no
 * matching flow series, the spark is an explicit "not served" slot instead of a
 * plausible line. Commission is never charted from GMV.
 */
type TileSpec = {
  id: string;
  label: string;
  /** Ordered candidate metrics, matched by group AND key. */
  metrics: MetricKey[];
  fallback?: (summary: Summary) => string | undefined;
  /** The flow shown under a level, e.g. "new registrations in this window". */
  flow?: { metrics: MetricKey[]; suffix: string };
  series?: { key: string; label: string };
  seriesNote: string;
  definition: string;
  href: string;
  icon: typeof Users;
  accent: Accent;
};

const TILE_SPECS: TileSpec[] = [
  {
    id: "users",
    label: "Total users",
    metrics: [
      { group: "growth", key: "registered_users" },
      { group: "growth", key: "total_users" },
    ],
    fallback: (summary) => summary.users.toLocaleString("en-KE"),
    flow: {
      metrics: [
        { group: "growth", key: "new_registrations" },
        { group: "users", key: "new_registrations" },
      ],
      suffix: "new in this window",
    },
    series: { key: "signups", label: "New registrations per day" },
    seriesNote: "Spark: new registrations per day — not the running total",
    definition: "Every registered account, including sellers and administrators. The second line is accounts created in the selected window, which is a different figure.",
    href: "/users",
    icon: Users,
    accent: "violet",
  },
  {
    id: "listings",
    label: "Live listings",
    metrics: [
      { group: "marketplace", key: "live_listings" },
      { group: "marketplace", key: "total_listings" },
    ],
    fallback: (summary) => (summary.listings_active ?? summary.listings).toLocaleString("en-KE"),
    flow: {
      metrics: [
        { group: "marketplace", key: "new_listings" },
        { group: "marketplace", key: "listings_created" },
      ],
      suffix: "created in this window",
    },
    series: { key: "listings_created", label: "New listings per day" },
    seriesNote: "Spark: new listings per day — not current live supply",
    definition: "Listings currently live. The second line is listings created in the selected window, and the spark is that daily creation flow — neither is the same as live supply.",
    href: "/listings?status=active",
    icon: PackageOpen,
    accent: "cyan",
  },
  {
    id: "deals",
    label: "Deals agreed",
    metrics: [
      { group: "marketplace", key: "deals_agreed" },
      { group: "marketplace", key: "deals" },
    ],
    fallback: (summary) => summary.deals.toLocaleString("en-KE"),
    series: { key: "deals_agreed", label: "Deals agreed per day" },
    seriesNote: "Spark: deals agreed per day",
    definition: "Deals with an agreed price in the selected window. Deals released or completed are counted separately.",
    href: "/deals",
    icon: Handshake,
    accent: "amber",
  },
  {
    id: "revenue",
    label: "Platform revenue",
    metrics: [
      { group: "financial", key: "revenue" },
      { group: "financial", key: "commission_recognised" },
    ],
    fallback: (summary) => formatKesAmount(summary.commission_earned_kes),
    seriesNote: "No daily revenue series is served — the analytics chart below plots GMV, a separate measure",
    definition: "Income recorded for BROKA in the window (listing fees and released commission). Not reconciled bank cash, and never derived from GMV.",
    href: "/revenue",
    icon: Wallet,
    accent: "emerald",
  },
];

/** Exact group+key lookup: two groups may legitimately share a key name. */
function findMetric(command: CommandCenter | undefined, keys: MetricKey[]): CommandMetric | undefined {
  if (!command) return undefined;
  for (const { group, key } of keys) {
    const match = command.groups.find((entry) => entry.key === group)?.metrics.find((metric) => metric.key === key);
    if (match) return match;
  }
  return undefined;
}

function availableValue(metric: CommandMetric | undefined): string | undefined {
  if (!metric?.available) return undefined;
  return formatMetricValue(metric.unit, metric.value);
}

/** Real series only: null buckets break the path, they are never drawn as zero. */
function Spark({ points, tone, label, seriesKey, note }: {
  points?: TimeseriesPoint[];
  tone: string;
  label: string;
  seriesKey?: string;
  note: string;
}) {
  const gradientId = useId();
  const measured = useMemo(
    () => (points ?? []).filter((point): point is { t: string; v: number } => point.v !== null),
    [points],
  );
  if (!seriesKey) {
    return (
      <div
        className="nx-metric__spark flex items-center rounded-md border border-dashed border-white/[0.08] px-2"
        data-testid="nx-spark-unavailable"
      >
        <span className="text-[8.5px] uppercase leading-[1.35] tracking-[0.12em] text-slate-600">Not charted · see definition</span>
      </div>
    );
  }
  if (measured.length < 2) {
    return (
      <div
        className="nx-metric__spark flex items-center rounded-md border border-dashed border-white/[0.07] px-2"
        data-testid="nx-spark-empty"
        aria-label={`${label}: no measured buckets in this window`}
      >
        <span className="text-[8.5px] uppercase leading-[1.35] tracking-[0.12em] text-slate-600">No measured buckets</span>
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
  // Keying the drawing on the measured values replays the draw animation when
  // real data changes — never on a timer and never without new data.
  const signature = `${seriesKey}:${measured.length}:${values.join(",")}`;
  return (
    <svg
      key={signature}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="nx-metric__spark w-full"
      role="img"
      aria-label={`${label}. ${note}.`}
      data-testid="nx-spark"
      data-series-key={seriesKey}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity={0.38} />
          <stop offset="100%" stopColor={tone} stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} className="nx-spark-fill" />
      <path
        d={path}
        fill="none"
        stroke={tone}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="nx-spark-line"
      />
      <circle cx={width} cy={lastY} r="1.8" fill={tone} className="nx-spark-dot" />
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
 * or the verified admin summary, and each sparkline is the measured series for
 * the measure it is labelled with. A figure or series the backend does not
 * serve is stated as such rather than replaced by a related metric.
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
        const metric = findMetric(command, spec.metrics);
        const fallback = summary ? spec.fallback?.(summary) : undefined;
        const value = availableValue(metric) ?? fallback ?? "—";
        const flowMetric = spec.flow ? findMetric(command, spec.flow.metrics) : undefined;
        const flowValue = availableValue(flowMetric);
        const caption = metric
          ? metric.available
            ? metric.caption ?? `${windowDays}-day window`
            : metric.unavailable_reason ?? "Not measured by the backend"
          : fallback
            ? `Verified summary · ${windowDays}-day comparison unavailable`
            : "Waiting for a verified response";
        const Icon = spec.icon;
        return (
          <Link
            key={spec.id}
            href={spec.href}
            className={cn("nx-metric focus-ring min-h-[168px]", ACCENT_CLASS[spec.accent])}
            aria-label={`${spec.label}: ${value}. Open the workspace.`}
            title={spec.definition}
            data-testid={`nx-metric-${spec.id}`}
            data-series-key={spec.series?.key ?? "none"}
          >
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{spec.label}</p>
                <p className="nx-metric__value mt-2">{value}</p>
              </div>
              <span className={cn("nx-metric__icon", ACCENT_CLASS[spec.accent])} aria-hidden="true"><Icon size={16} /></span>
            </div>
            <div className="relative mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Trend metric={metric} />
              {spec.flow ? (
                <span className="text-[10px] text-slate-500" data-testid={`nx-metric-${spec.id}-flow`}>
                  {flowValue ?? "—"} {spec.flow.suffix}
                </span>
              ) : null}
            </div>
            <Spark
              points={spec.series ? series?.[spec.series.key] : undefined}
              tone={ACCENT_STROKE[spec.accent]}
              label={spec.series ? `${spec.series.label} for the last ${windowDays} days` : `${spec.label} trend`}
              seriesKey={spec.series?.key}
              note={spec.seriesNote}
            />
            <p className="relative mt-1 truncate text-[9.5px] text-slate-600" title={`${spec.seriesNote} · ${caption}`}>{spec.seriesNote}</p>
          </Link>
        );
      })}
    </section>
  );
}
