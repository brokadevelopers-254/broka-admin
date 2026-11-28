"use client";

import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  Loader2,
  MessageSquareWarning,
  Send,
  ShieldAlert,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import { InfoTip } from "@/components/ui/tooltip";
import { isEndpointMissing, useAdminResource } from "@/hooks/use-admin-resource";
import type { Insight, InsightSeverity } from "@/lib/api/intelligence-schemas";
import { SEVERITY_META, SEVERITY_ORDER, isInternalHref, relativeTime } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

const SEVERITY_RANK: Record<InsightSeverity, number> = Object.fromEntries(
  SEVERITY_ORDER.map((severity, index) => [severity, index]),
) as Record<InsightSeverity, number>;

const SEVERITY_ICON: Record<InsightSeverity, typeof ShieldAlert> = {
  critical: ShieldAlert,
  warning: CircleAlert,
  opportunity: Sparkles,
  info: Sparkles,
  positive: Sparkles,
};

// Static classes so Tailwind emits them; never build a class name at runtime.
const SEVERITY_ICON_CLASS: Record<InsightSeverity, string> = {
  critical: "border-rose-400/30 text-rose-300",
  warning: "border-amber-300/30 text-amber-200",
  opportunity: "border-[#947bff]/35 text-[#c9beff]",
  info: "border-white/12 text-slate-300",
  positive: "border-emerald-400/30 text-emerald-300",
};

/**
 * Jarvis, in context rather than as a chat window bolted onto a page.
 *
 * The rail shows the backend's own rule signals for the current 7/30-day
 * window — measured conditions with their evidence and the workspace that
 * explains them. The composer does not fabricate an answer here: it opens
 * Jarvis in the Zeno workspace with the question prefilled, where the
 * authorized assistant answers from verified figures and states its method.
 */
export function JarvisContextPanel({
  contextLabel = "this workspace",
  windowDays = 7,
  onClose,
  className,
}: {
  contextLabel?: string;
  windowDays?: number;
  onClose?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const query = useMemo(() => new URLSearchParams({ window_days: String(windowDays) }), [windowDays]);
  const insights = useAdminResource("intelligenceInsights", query);

  const ranked = useMemo(() => {
    const list = [...(insights.data?.insights ?? [])];
    return list
      .map((insight, index) => ({ insight, index }))
      .sort((a, b) => {
        const severity = SEVERITY_RANK[a.insight.severity] - SEVERITY_RANK[b.insight.severity];
        return severity !== 0 ? severity : a.index - b.index;
      })
      .map(({ insight }) => insight);
  }, [insights.data]);

  const attention = ranked.filter((insight) => insight.severity === "critical" || insight.severity === "warning").length;
  const missing = isEndpointMissing(insights.error);
  const state = insights.isLoading ? "loading" : missing ? "unavailable" : insights.isError ? "error" : ranked.length ? "ready" : "empty";

  const statusCopy = {
    loading: "Reading rule signals",
    unavailable: "Insight feed not deployed",
    error: "Insight feed unreachable",
    empty: "No rule signal in this window",
    ready: attention ? `${attention} signal${attention === 1 ? "" : "s"} need attention` : "No critical or warning signal",
  }[state];

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    router.push(`/assistant?ask=${encodeURIComponent(text)}`);
  }

  return (
    <aside className={cn("nx-jarvis flex flex-col", className)} aria-labelledby="jarvis-context-title">
      <div className="flex items-start justify-between gap-2 border-b border-white/[0.07] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="nx-jarvis-orb" aria-hidden="true">
            <Bot size={19} className="text-white/90" />
          </span>
          <div className="min-w-0">
            <h2 id="jarvis-context-title" className="flex items-center gap-1.5 font-display text-[13px] font-bold tracking-[-0.01em] text-white">
              Jarvis
              <span className="rounded border border-[#947bff]/30 bg-[#947bff]/12 px-1 py-px text-[8px] font-bold uppercase tracking-[0.14em] text-[#cfc6ff]">Beta</span>
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
              <span className="nx-pulse-dot" data-tone={state === "ready" ? "muted" : state === "error" ? "danger" : state === "unavailable" ? "warning" : "muted"} data-live={state === "ready" ? "true" : "false"} aria-hidden="true" />
              {statusCopy}
            </p>
          </div>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="focus-ring rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close Jarvis panel">
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span className="nx-jarvis-orb !h-8 !w-8 shrink-0" aria-hidden="true">
            <Bot size={14} className="text-white/90" />
          </span>
          <p className="nx-jarvis-bubble min-w-0">
            {state === "loading" ? (
              <span className="inline-flex items-center gap-2 text-slate-400"><Loader2 size={12} className="animate-spin" aria-hidden="true" />Reading the rule engine…</span>
            ) : state === "unavailable" ? (
              <>The backend does not serve its insight endpoint yet, so Jarvis has no verified signal to quote for {contextLabel}. Measured panels elsewhere on this page are unaffected.</>
            ) : state === "error" ? (
              <>The insight feed could not be reached. Jarvis will not guess at what {contextLabel} looks like without a response.</>
            ) : state === "empty" ? (
              <>For the last {windowDays} days, no rule signal is flagged in {contextLabel}. That is the literal result of the checks, not a forecast.</>
            ) : (
              <>Here is what BROKA&apos;s rule engine reports for {contextLabel}: {attention ? <strong className="text-white">{attention} signal{attention === 1 ? "" : "s"} need a decision</strong> : <strong className="text-white">no critical or warning signal</strong>}. Each item opens the workspace that explains it.</>
            )}
          </p>
        </div>

        {state === "loading" ? (
          <div className="space-y-2" aria-busy="true">
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
            <div className="skeleton h-12" />
          </div>
        ) : null}

        {ranked.length ? (
          <ul className="space-y-2" aria-label="Rule signals from the backend">
            {ranked.slice(0, 4).map((insight) => <InsightRow key={insight.id} insight={insight} />)}
          </ul>
        ) : null}

        <div className="space-y-1.5 pt-1">
          <p className="px-1 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-600">Go deeper</p>
          <Link href="/intelligence#insights" className="nx-jarvis-chip focus-ring">
            <Sparkles size={13} className="text-[#c9beff]" aria-hidden="true" /> All founder insights <ArrowUpRight size={12} className="ml-auto text-slate-500" aria-hidden="true" />
          </Link>
          <Link href="/complaints" className="nx-jarvis-chip focus-ring">
            <MessageSquareWarning size={13} className="text-amber-200" aria-hidden="true" /> Trust desk and complaints <ArrowUpRight size={12} className="ml-auto text-slate-500" aria-hidden="true" />
          </Link>
          <Link href="/market" className="nx-jarvis-chip focus-ring">
            <Store size={13} className="text-[#8fe6f5]" aria-hidden="true" /> Marketplace intelligence <ArrowUpRight size={12} className="ml-auto text-slate-500" aria-hidden="true" />
          </Link>
          <Link href="/assistant" className="nx-jarvis-chip focus-ring">
            <Bot size={13} className="text-[#c9beff]" aria-hidden="true" /> Open the Jarvis workspace <ArrowUpRight size={12} className="ml-auto text-slate-500" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <form onSubmit={ask} className="border-t border-white/[0.07] px-4 py-3">
        <label htmlFor="jarvis-context-question" className="sr-only">Ask Jarvis a question</label>
        <div className="nx-jarvis-input">
          <input
            id="jarvis-context-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask Jarvis anything…"
            autoComplete="off"
          />
          <button type="submit" className="nx-jarvis-send" aria-label="Ask Jarvis in the Jarvis workspace">
            <Send size={15} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 flex items-start gap-1 text-[9.5px] leading-4 text-slate-600">
          <InfoTip label="How this question is answered">Opens Jarvis with your question prefilled. Jarvis answers from verified backend figures and states its method; nothing is generated on this page.</InfoTip>
          <span className="pl-0.5">Answers come from verified figures. Sending opens the Jarvis workspace.</span>
        </p>
      </form>
    </aside>
  );
}

function InsightRow({ insight }: { insight: Insight }) {
  const meta = SEVERITY_META[insight.severity];
  const Icon = SEVERITY_ICON[insight.severity];
  const href = insight.action && isInternalHref(insight.action.href) ? insight.action.href : null;
  const body = (
    <div className="nx-row">
      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border bg-white/[0.03]", SEVERITY_ICON_CLASS[insight.severity])} aria-hidden="true">
        <Icon size={12} className={meta.text} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-semibold leading-snug text-slate-100">{insight.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.1em] text-slate-500">
          <span className={meta.text}>{meta.label}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate normal-case tracking-normal">{insight.area.replaceAll("_", " ")}</span>
        </span>
      </span>
      {href ? <ArrowUpRight size={12} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" /> : null}
    </div>
  );
  if (href) return <li><Link href={href} className="focus-ring block rounded-xl">{body}</Link></li>;
  return <li>{body}</li>;
}

/** The compact strip that contextually names what Jarvis can see on this route. */
export function JarvisContextLine({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#947bff]/20 bg-[#947bff]/[0.06] px-3 py-2">
      <span className="grid h-6 w-6 place-items-center rounded-full border border-[#947bff]/40 bg-[#947bff]/15 text-[#ded8ff]" aria-hidden="true">
        <Bot size={12} />
      </span>
      <p className="text-[11px] font-semibold text-slate-200">{label}</p>
      <span className="hidden h-3 w-px bg-white/10 sm:block" aria-hidden="true" />
      <p className="text-[10.5px] text-slate-500">{detail}</p>
    </div>
  );
}

export function insightUpdatedLabel(generatedAt: string | null | undefined): string {
  return generatedAt ? `rule signals generated ${relativeTime(generatedAt)}` : "rule signals";
}
