"use client";

import {
  Activity, BadgeDollarSign, BarChart3, Bell, Bot, Briefcase, ChevronDown, ChevronLeft, ChevronRight, ClipboardList,
  Cpu, CornerDownLeft, FileSearch, FileText, Gauge, Landmark, LayoutDashboard, LogOut, Mail, Megaphone, Menu,
  Microscope, MessageSquareWarning, Network, Orbit, PanelRight, Radar, Radio, Receipt, Search, ShieldAlert, Sparkles, Store,
  TrendingUp, Users, X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { cn, formatRouteLabel } from "@/lib/utils";
import { JARVIS_SECTIONS, sectionForPath, type JarvisSectionKey } from "@/lib/jarvis/sections";
import { useUnreadAlerts } from "@/hooks/use-alerts";
import { useAlertsStream } from "@/hooks/use-alerts-stream";
import { useAdminResource } from "@/hooks/use-admin-resource";
import type { AdminIdentity } from "@/types/broka";
import { InfoTip } from "@/components/ui/tooltip";
import { JarvisContextPanel } from "@/components/nexus/jarvis-context";
import { workspaceContextFor } from "@/lib/nexus/workspace-context";

type NavEntry = { label: string; href: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; badge?: "complaints" };
type NavGroup = { label: string; entries: NavEntry[] };

// One icon per Jarvis section. The section list itself lives in lib/jarvis/sections.ts.
const JARVIS_ICONS: Record<JarvisSectionKey, NavEntry["icon"]> = {
  command: Orbit,
  core: Cpu,
  business: Briefcase,
  marketplace: Store,
  trust: ShieldAlert,
  operations: Activity,
  studio: Microscope,
  live: Radio,
};

const navGroups: NavGroup[] = [
  { label: "Jarvis Mode", entries: JARVIS_SECTIONS.map((section) => ({ label: section.label, href: section.href, icon: JARVIS_ICONS[section.key] })) },
  { label: "Founder", entries: [{ label: "Command Center", href: "/", icon: LayoutDashboard }, { label: "Intelligence", href: "/intelligence", icon: Radar }, { label: "Growth", href: "/growth", icon: TrendingUp }, { label: "Market Intelligence", href: "/market", icon: Radar }, { label: "Reports", href: "/reports", icon: FileText }, { label: "Report Builder", href: "/reports/builder", icon: FileText }] },
  { label: "Respond", entries: [{ label: "Complaints", href: "/complaints", icon: MessageSquareWarning, badge: "complaints" }, { label: "Email Reply", href: "/email-reply", icon: Mail }, { label: "Alert Centre", href: "/alerts", icon: Bell }] },
  { label: "Marketplace", entries: [{ label: "Listings", href: "/listings", icon: Store }, { label: "Deals", href: "/deals", icon: ClipboardList }, { label: "Stores", href: "/stores", icon: Store }] },
  { label: "Identity", entries: [{ label: "All Users", href: "/users", icon: Users }, { label: "Admins", href: "/users?type=admin", icon: Users }] },
  { label: "Trust & Safety", entries: [{ label: "Fraud", href: "/fraud", icon: ShieldAlert }, { label: "Disputes", href: "/disputes", icon: FileSearch }] },
  { label: "Money", entries: [{ label: "Revenue", href: "/revenue", icon: BarChart3 }, { label: "Production Costs", href: "/production-costs", icon: Receipt }, { label: "Payments", href: "/payments", icon: Landmark }, { label: "Finance Integrity", href: "/finance-integrity", icon: BadgeDollarSign }, { label: "Transactions", href: "/transactions", icon: Landmark }, { label: "Escrow", href: "/escrow", icon: BadgeDollarSign }, { label: "Commissions", href: "/commissions", icon: BarChart3 }] },
  { label: "Zeno", entries: [{ label: "AI Activity", href: "/zeno/activity", icon: Bot }, { label: "Negotiations", href: "/zeno/negotiations", icon: Bot }, { label: "AI Savings", href: "/zeno/savings", icon: Bot }] },
  { label: "Analytics", entries: [{ label: "Platform", href: "/analytics/platform", icon: BarChart3 }, { label: "Marketplace", href: "/analytics/marketplace", icon: BarChart3 }, { label: "Users", href: "/analytics/users", icon: BarChart3 }] },
  { label: "System", entries: [{ label: "Service Communications", href: "/communications", icon: Megaphone }, { label: "Operations", href: "/operations", icon: Activity }, { label: "Service Health", href: "/service-health", icon: Gauge }, { label: "Audit Logs", href: "/audit-logs", icon: ClipboardList }, { label: "Diagnostics", href: "/diagnostics", icon: Gauge }, { label: "Events", href: "/events", icon: Activity }, { label: "Workflow Versions", href: "/workflow-versions", icon: Network }, { label: "Settings", href: "/settings", icon: Gauge }] },
];

const allEntries = navGroups.flatMap((group) => group.entries.map((entry) => ({ ...entry, group: group.label })));

type ComplaintBadge = { count: number; urgent: boolean } | null;

function useComplaintBadge(enabled: boolean): ComplaintBadge {
  const stats = useAdminResource("feedbackStats", undefined, enabled);
  if (!stats.data) return null;
  return { count: stats.data.unanswered, urgent: stats.data.sla_breached > 0 };
}

function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" aria-label="BROKA Admin Nexus command center" className={cn("focus-ring flex items-center rounded-xl px-1.5 py-2", compact ? "justify-center" : "gap-3")}>
      <span className="nx-brand-mark">
        <img src="/brand/broka-mark.png" alt="" className="h-7 w-7 object-contain p-0.5" />
      </span>
      {compact ? null : (
        <div className="min-w-0">
          <p className="font-display text-[17px] font-black leading-none tracking-[-0.045em] text-white">BROKA</p>
          <p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.32em] text-[#a895ff]">Admin Nexus</p>
        </div>
      )}
    </Link>
  );
}

function entryIsActive(pathname: string, href: string, currentSearch: string) {
  const [path, query] = href.split("?");
  if (pathname !== path) return false;
  if (query) {
    const target = new URLSearchParams(query);
    const current = new URLSearchParams(currentSearch);
    return Array.from(target.entries()).every(([key, value]) => current.get(key) === value);
  }
  return !(path === "/users" && new URLSearchParams(currentSearch).get("type") === "admin");
}

function RailContent({ onNavigate, complaints, collapsed = false }: { onNavigate?: () => void; complaints: ComplaintBadge; collapsed?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  return (
    <nav className={cn("scroll-thin flex-1 overflow-y-auto pb-4 pt-2", collapsed ? "px-2" : "px-3")} aria-label="Admin navigation">
      {navGroups.map((group) => (
        <section key={group.label} className="nx-nav-group">
          {collapsed ? (
            <div className="mx-auto my-2 h-px w-6 bg-white/[0.08]" aria-hidden="true" />
          ) : (
            <p className="nx-nav-label">{group.label}</p>
          )}
          <div className="space-y-0.5">
            {group.entries.map((entry) => {
              const isActive = entryIsActive(pathname, entry.href, searchParams.toString());
              const Icon = entry.icon;
              const badge = entry.badge === "complaints" && complaints && complaints.count > 0 ? complaints : null;
              return (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? entry.label : undefined}
                  title={collapsed ? `${entry.label} · ${group.label}` : undefined}
                  className={cn("nx-nav-item", collapsed && "justify-center !px-1")}
                >
                  <span className="nx-nav-icon" aria-hidden="true">
                    <Icon size={15} strokeWidth={isActive ? 2.2 : 1.7} />
                  </span>
                  {collapsed ? null : <span className="truncate">{entry.label}</span>}
                  {badge ? (
                    <span
                      className={cn(
                        "rounded-full text-[9.5px] font-black tabular-nums",
                        collapsed ? "absolute right-0.5 top-0.5 h-2 w-2 p-0 text-transparent" : "ml-auto px-1.5 py-0.5",
                        badge.urgent ? "bg-rose-500 text-white shadow-[0_0_12px_rgba(251,113,133,0.6)]" : "bg-[#947bff]/30 text-[#efeaff]",
                      )}
                      aria-label={`${badge.count} awaiting a reply${badge.urgent ? ", some past deadline" : ""}`}
                      title={collapsed ? `${badge.count} awaiting a reply` : undefined}
                    >
                      {badge.count > 99 ? "99+" : badge.count}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function SystemStatus({ apiLabel, apiTone, streamLabel, streamRef }: {
  apiLabel: string;
  apiTone: "success" | "warning" | "danger" | "neutral";
  streamLabel: string;
  streamRef: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="nx-status-card" aria-label="System status">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">System status</p>
        <span ref={streamRef} className="nx-pulse-dot" data-tone={apiTone === "success" ? "warning" : apiTone === "danger" ? "danger" : "muted"} data-live="false" aria-hidden="true" />
      </div>
      <div className="mt-1.5 space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
          <span className="nx-pulse-dot" data-tone={apiTone === "success" ? "warning" : apiTone === "danger" ? "danger" : "muted"} aria-hidden="true" />
          <span className="truncate">{apiLabel}</span>
        </p>
        <p className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className="nx-pulse-dot" data-tone={streamLabel === "Live" ? "success" : "muted"} data-live={streamLabel === "Live" ? "true" : "false"} aria-hidden="true" />
          <span className="truncate">Alert stream · {streamLabel}</span>
        </p>
      </div>
    </div>
  );
}

function UserFooter({ admin, collapsed = false }: { admin: AdminIdentity; collapsed?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className={cn("border-t border-white/[0.07] p-3", collapsed && "px-2")}>
      <div className={cn("flex items-center rounded-xl border border-white/[0.07] bg-white/[0.03] p-2", collapsed ? "flex-col gap-2 px-1" : "gap-2.5")}>
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#cfc6ff] to-[#7c63ff] text-[11px] font-black text-slate-950" aria-hidden="true">
          {admin.displayName.slice(0, 1).toUpperCase()}
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#090c18] bg-emerald-400" />
        </span>
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold text-slate-100">{admin.displayName}</p>
            <p className="truncate text-[9.5px] text-slate-500">{admin.roleLabel}</p>
          </div>
        )}
        <button onClick={logout} disabled={busy} className="focus-ring rounded-md p-1.5 text-slate-500 transition hover:bg-white/5 hover:text-rose-300 disabled:opacity-50" aria-label="Log out" title={collapsed ? "Log out" : undefined}>
          <LogOut size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

type PaletteItem = { key: string; label: string; hint: string; href: string; icon: NavEntry["icon"]; group: string };
type RecentRoute = { href: string; label: string };

// Session-only: the authenticated shell forbids browser storage, so recent
// destinations live in memory and disappear with the tab.
const recentRoutes: RecentRoute[] = [];
function rememberRoute(route: RecentRoute) {
  const existing = recentRoutes.findIndex((entry) => entry.href === route.href);
  if (existing >= 0) recentRoutes.splice(existing, 1);
  recentRoutes.unshift(route);
  if (recentRoutes.length > 5) recentRoutes.length = 5;
}

/** Ctrl/⌘+K: jump to any surface, or search users and complaints. */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => previous?.focus();
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim();
    const needle = q.toLowerCase();
    const pages = allEntries
      .filter((entry) => !needle || entry.label.toLowerCase().includes(needle) || entry.group.toLowerCase().includes(needle))
      .map((entry) => ({ key: entry.href, label: entry.label, hint: entry.group, href: entry.href, icon: entry.icon, group: entry.group }));
    if (!q) {
      const recents: PaletteItem[] = recentRoutes.map((route) => {
        const match = allEntries.find((entry) => entry.href === route.href);
        return { key: `recent-${route.href}`, label: route.label, hint: route.href, href: route.href, icon: match?.icon ?? LayoutDashboard, group: "Jump back in" };
      });
      const quick: PaletteItem[] = [
        { key: "quick-overdue", label: "Complaints past their deadline", hint: "Trust desk", href: "/complaints?queue=overdue", icon: MessageSquareWarning, group: "Quick actions" },
        { key: "quick-fraud", label: "Open fraud queue", hint: "Trust & Safety", href: "/fraud?state=open", icon: ShieldAlert, group: "Quick actions" },
        { key: "quick-integrity", label: "Finance integrity controls", hint: "Money", href: "/finance-integrity", icon: BadgeDollarSign, group: "Quick actions" },
        { key: "quick-jarvis", label: "Ask Jarvis", hint: "Jarvis Mode", href: "/assistant", icon: Bot, group: "Quick actions" },
      ];
      return [...recents, ...quick, ...pages];
    }
    const searches: PaletteItem[] = [
      { key: "search-users", label: `Search users for “${q}”`, hint: "Name, email or phone", href: `/users?search=${encodeURIComponent(q)}`, icon: Users, group: "Search records" },
      { key: "search-complaints", label: `Search complaints for “${q}”`, hint: /^#?[0-9a-f]{6}$/i.test(q) ? "Complaint reference" : "Subject or reference", href: `/complaints?search=${encodeURIComponent(q)}&queue=all`, icon: MessageSquareWarning, group: "Search records" },
    ];
    return [...pages, ...searches];
  }, [query]);

  const groups = useMemo(() => {
    const buckets = new Map<string, PaletteItem[]>();
    for (const item of items) {
      const bucket = buckets.get(item.group);
      if (bucket) bucket.push(item); else buckets.set(item.group, [item]);
    }
    return Array.from(buckets.entries());
  }, [items]);
  const positionOf = useMemo(() => new Map(items.map((item, position) => [item.key, position])), [items]);

  useEffect(() => { setIndex(0); }, [query]);

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setIndex((current) => (items.length ? (current + 1) % items.length : 0)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setIndex((current) => (items.length ? (current - 1 + items.length) % items.length : 0)); }
    else if (event.key === "Enter") { event.preventDefault(); go(items[index]); }
    else if (event.key === "Tab") event.preventDefault();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/75 px-4 pt-[10vh] backdrop-blur-sm" onKeyDown={onKeyDown}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close command palette" tabIndex={-1} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Command palette" className="palette-panel nx-panel relative w-full max-w-xl overflow-hidden !rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3">
          <Search size={16} className="text-[#c9beff]" aria-hidden="true" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search across BROKA… (pages, users, complaints)" aria-label="Command" aria-controls="palette-results" aria-activedescendant={items[index] ? `palette-${items[index].key}` : undefined} role="combobox" aria-expanded="true" className="h-9 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600" />
          <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">Esc</kbd>
        </div>
        <ul id="palette-results" role="listbox" aria-label="Results" className="scroll-thin max-h-[54vh] overflow-y-auto p-2">
          {groups.map(([group, entries]) => (
            <li key={group} role="presentation">
              <p className="px-3 pb-1 pt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">{group}</p>
              <ul role="group" aria-label={group}>
                {entries.map((item) => {
                  const Icon = item.icon;
                  const position = positionOf.get(item.key) ?? -1;
                  const active = position === index;
                  return (
                    <li key={item.key} id={`palette-${item.key}`} role="option" aria-selected={active}>
                      <button type="button" tabIndex={-1} onMouseEnter={() => setIndex(position)} onClick={() => go(item)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition", active ? "bg-[#947bff]/15 text-white" : "text-slate-300")}>
                        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg border", active ? "border-[#947bff]/45 bg-[#947bff]/15 text-[#ded8ff]" : "border-white/[0.07] bg-white/[0.03] text-slate-400")} aria-hidden="true"><Icon size={15} /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.label}</span><span className="block truncate text-[11px] text-slate-500">{item.hint}</span></span>
                        {active ? <CornerDownLeft size={14} className="text-slate-500" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
          {!items.length ? <li className="px-3 py-6 text-center text-xs text-slate-500">No page matches. Type a name to search users.</li> : null}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-4 py-2 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 px-1">↑</kbd><kbd className="rounded border border-white/10 px-1">↓</kbd> navigate</span>
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 px-1">↵</kbd> open</span>
          <span className="inline-flex items-center gap-1"><kbd className="rounded border border-white/10 px-1">Esc</kbd> close</span>
          <span className="ml-auto">Users and complaints only, where the backend supports the search. Nothing is stored.</span>
        </div>
      </div>
    </div>
  );
}

function Breadcrumbs({ pathname, group, title }: { pathname: string; group?: string; title: string }) {
  const segments = pathname.split("/").filter(Boolean);
  const root = segments[0];
  const isDetail = segments.length > 1;
  const rootEntry = root ? allEntries.find((entry) => entry.href.split("?")[0] === `/${root}` && !entry.href.includes("?")) : undefined;
  // Every Jarvis section lives under /assistant. Its crumbs name the workspace, then the section.
  const jarvis = root === "assistant";
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 whitespace-nowrap text-[10.5px] text-slate-500 xl:flex">
      {pathname === "/" ? <><span className="text-slate-400">Founder</span><ChevronRight size={10} aria-hidden="true" /><span className="truncate text-slate-300">Command Center</span></> : <>
        <Link href="/" className="focus-ring whitespace-nowrap rounded hover:text-slate-200">Command Center</Link>
        {root ? <><ChevronRight size={10} aria-hidden="true" /><Link href={`/${root}`} className="focus-ring rounded hover:text-slate-200">{jarvis ? "Jarvis Mode" : (rootEntry?.label ?? formatRouteLabel(root))}</Link></> : null}
        {isDetail ? <><ChevronRight size={10} aria-hidden="true" /><span className="truncate text-slate-300">{jarvis ? sectionForPath(pathname).label : formatRouteLabel(segments[1])}</span></> : null}
        {group && !root ? <><ChevronRight size={10} aria-hidden="true" /><span className="truncate text-slate-300">{title}</span></> : null}
      </>}
    </nav>
  );
}

export function AdminShell({ children, admin, apiConfigured }: { children: React.ReactNode; admin: AdminIdentity; apiConfigured: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [jarvisOpen, setJarvisOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEntry = allEntries.find((entry) => entryIsActive(pathname, entry.href, searchParams.toString()));
  const knownTitle = activeEntry?.label;
  const pageTitle = pathname === "/" ? "Command Center" : knownTitle ?? pathname.split("/").filter(Boolean).map((part) => part.replaceAll("-", " ")).join(" / ");
  const groupLabel = activeEntry?.group;

  // A configured URL is not evidence of connectivity or contract
  // compatibility. Only a validated /health response may show green.
  const health = useAdminResource("health", undefined, apiConfigured);
  const unread = useUnreadAlerts(apiConfigured);
  const stream = useAlertsStream(apiConfigured);
  const complaints = useComplaintBadge(apiConfigured);
  const unreadCount = unread.data ?? 0;
  const apiState = !apiConfigured ? "not-configured" : health.isLoading ? "checking" : health.isSuccess ? "healthy" : "failed";
  const apiBadge = {
    "not-configured": { tone: "warning" as const, label: "API not configured", detail: "BROKA_API_URL is not set for this deployment." },
    checking: { tone: "neutral" as const, label: "Checking API", detail: "Verifying /health through the server proxy." },
    healthy: { tone: "success" as const, label: "API healthy", detail: "API health verified: the public /health endpoint responded and matched its contract. This does not prove every admin endpoint is deployed." },
    failed: { tone: "danger" as const, label: "API health failed", detail: "API health check failed: the BROKA API health response was unreachable or invalid." },
  }[apiState];
  const streamBadge = {
    connected: { tone: "success" as const, label: "Live", detail: "The persisted alert stream is connected. Alerts arrive without a page refresh." },
    connecting: { tone: "warning" as const, label: "Connecting", detail: "The alert stream is opening. Persisted alerts still load over HTTP." },
    offline: { tone: "neutral" as const, label: "Offline", detail: "The live alert stream is not connected. Alerts still refresh on demand; this is not proof of backend health." },
  }[stream.status === "connected" ? "connected" : stream.status === "connecting" ? "connecting" : "offline"];

  // The rail preference is intentionally in-memory only: the dashboard
  // security contract forbids browser storage in the authenticated shell.
  function toggleCollapsed() {
    setCollapsed((value) => !value);
  }

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "Escape") {
        setMobileOpen(false);
        setJarvisOpen(false);
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Record the destination for the palette's in-memory "Jump back in" group.
  useEffect(() => {
    const query = searchParams.toString();
    rememberRoute({ href: query ? `${pathname}?${query}` : pathname, label: pageTitle });
  }, [pathname, searchParams, pageTitle]);

  const streamRef = useRef<HTMLSpanElement | null>(null);
  const windowDays = searchParams.get("pulse") === "30" ? 30 : 7;
  // Jarvis is scoped to the workspace it is opened from: its insight areas,
  // name and suggested questions all come from the current route.
  const workspace = workspaceContextFor(pathname);
  const contextLabel = pathname === "/" ? "the Command Center" : workspace.label;

  return (
    <div className="nx-app text-slate-100">
      <a className="skip-link print-hidden" href="#admin-main">Skip to main content</a>
      <div className="nx-canvas print-hidden" aria-hidden="true">
        <div className="nx-stars" />
      </div>

      <aside
        className={cn("nx-rail print-hidden fixed inset-y-0 left-0 z-30 hidden flex-col transition-[width] duration-200 lg:flex", collapsed ? "w-[84px]" : "w-[268px]")}
        aria-label="Primary navigation"
      >
        <span className="nx-rail-edge" aria-hidden="true" />
        <div className={cn("flex items-center pt-4", collapsed ? "justify-center px-3" : "justify-between px-4")}>
          <BrandLockup compact={collapsed} />
          {collapsed ? null : (
            <button type="button" onClick={toggleCollapsed} className="focus-ring rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Collapse navigation">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {collapsed ? (
          <button type="button" onClick={toggleCollapsed} className="focus-ring mx-auto mt-2 rounded-md p-1.5 text-slate-500 hover:bg-white/5 hover:text-slate-200" aria-label="Expand navigation">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : null}
        <RailContent complaints={complaints} collapsed={collapsed} />
        <div className={cn("space-y-2 px-3 pb-3", collapsed && "px-2")}>
          {collapsed ? null : <SystemStatus apiLabel={apiBadge.label} apiTone={apiBadge.tone} streamLabel={streamBadge.label} streamRef={streamRef} />}
          <InfoTip label="System status">{`${apiBadge.detail} ${streamBadge.detail}`}</InfoTip>
        </div>
        <UserFooter admin={admin} collapsed={collapsed} />
      </aside>

      {mobileOpen ? <button className="fixed inset-0 z-40 bg-black/75 backdrop-blur-[2px] lg:hidden" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /> : null}
      {/* Off-screen while closed: inert keeps its links out of the tab order and the accessibility tree. */}
      <aside inert={!mobileOpen} aria-hidden={!mobileOpen} className={cn("nx-rail print-hidden fixed inset-y-0 left-0 z-50 flex w-[300px] flex-col shadow-2xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")} aria-label="Mobile navigation">
        <div className="flex items-center justify-between px-4 pt-4">
          <BrandLockup />
          <button className="nx-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17} /></button>
        </div>
        <RailContent complaints={complaints} onNavigate={() => setMobileOpen(false)} />
        <div className="px-3 pb-3"><SystemStatus apiLabel={apiBadge.label} apiTone={apiBadge.tone} streamLabel={streamBadge.label} streamRef={streamRef} /></div>
        <UserFooter admin={admin} />
      </aside>

      <div className={cn("relative z-10 min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[84px]" : "lg:pl-[268px]")}>
        <header className="nx-header print-hidden">
          <button className="nx-icon-btn lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={18} /></button>

          <div className="hidden min-w-0 shrink-0 lg:block">
            <Breadcrumbs pathname={pathname} group={groupLabel} title={pageTitle} />
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <p className="truncate font-display text-[15px] font-bold tracking-[-0.02em] text-white">{pageTitle}</p>
              <span className="hidden shrink-0 items-center gap-1 rounded-full border border-[#947bff]/22 bg-[#947bff]/[0.08] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#c9beff] xl:inline-flex">
                <Sparkles size={9} aria-hidden="true" />
                {groupLabel ?? "BROKA operations"}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-center px-1 lg:px-4">
            <button type="button" onClick={() => setPaletteOpen(true)} className="nx-search focus-ring w-full max-w-xl max-sm:w-10 max-sm:justify-center max-sm:px-0" aria-label="Open command palette to search or jump to a page">
              <Search size={16} aria-hidden="true" />
              <span className="hidden min-w-0 flex-1 truncate text-left text-xs sm:block">Search across BROKA…</span>
              <kbd className="hidden rounded border border-white/10 bg-black/30 px-1.5 py-0.5 text-[10px] text-slate-500 sm:inline">⌘ K</kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/22 bg-emerald-400/[0.07] px-2.5 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-emerald-200 xl:inline-flex">
              <span className="nx-pulse-dot" data-tone={apiBadge.tone === "success" ? "success" : apiBadge.tone === "danger" ? "danger" : "muted"} data-live={apiBadge.tone === "success" ? "true" : "false"} aria-hidden="true" />
              {apiBadge.label}
              <InfoTip label="Backend connectivity">{apiBadge.detail}</InfoTip>
            </span>
            <button type="button" onClick={() => setJarvisOpen(true)} className="nx-jarvis-btn focus-ring" aria-label="Open Jarvis context panel" aria-expanded={jarvisOpen}>
              <Bot size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Jarvis</span>
              <span className="nx-pulse-dot" data-tone={streamBadge.label === "Live" ? "success" : "muted"} data-live={streamBadge.label === "Live" ? "true" : "false"} aria-hidden="true" />
            </button>
            {complaints && complaints.count > 0 ? (
              <Link href="/complaints" className={cn("nx-icon-btn focus-ring relative", complaints.urgent && "!border-rose-400/40 !text-rose-200")} aria-label={`Open complaints, ${complaints.count} awaiting a reply`}>
                <MessageSquareWarning size={17} aria-hidden="true" />
                <span className={cn("absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[9.5px] font-black text-white", complaints.urgent ? "bg-rose-500" : "bg-[#7c63ff]")} aria-hidden="true">{complaints.count > 99 ? "99+" : complaints.count}</span>
              </Link>
            ) : null}
            <Link href="/alerts" className="nx-icon-btn focus-ring relative" aria-label={unreadCount > 0 ? `Open alert centre, ${unreadCount} unread alerts` : "Open alert centre, no unread alerts"}>
              <Bell size={17} aria-hidden="true" />
              {unreadCount > 0 ? <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[9.5px] font-black text-white" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
            </Link>
            <button type="button" onClick={() => setJarvisOpen((open) => !open)} className="nx-icon-btn focus-ring hidden xl:grid" aria-label="Open Jarvis context panel" aria-expanded={jarvisOpen}>
              <PanelRight size={17} aria-hidden="true" />
            </button>
            <div className="ml-0.5 flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] py-1 pl-1 pr-2" aria-label={`Signed in as ${admin.displayName}, ${admin.roleLabel}`}>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#cfc6ff] to-[#7c63ff] text-[10px] font-black text-slate-950" aria-hidden="true">{admin.displayName.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-24 truncate text-[11px] font-semibold text-slate-200 md:inline">{admin.displayName}</span>
              <ChevronDown size={12} className="hidden text-slate-500 md:inline" aria-hidden="true" />
            </div>
          </div>
        </header>

        <div className="px-4 pb-2 pt-3 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-display text-[15px] font-bold text-white">{pageTitle}</p>
            <span className="shrink-0 rounded-full border border-[#947bff]/22 bg-[#947bff]/[0.08] px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#c9beff]">{groupLabel ?? "BROKA"}</span>
          </div>
        </div>

        <main id="admin-main" className="mx-auto w-full max-w-[1720px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">{children}</main>
      </div>

      {jarvisOpen ? (
        <>
          <button type="button" className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-[1px]" aria-label="Close Jarvis panel" onClick={() => setJarvisOpen(false)} />
          <JarvisContextPanel
            contextLabel={contextLabel}
            windowDays={windowDays}
            areas={workspace.areas}
            prompts={workspace.prompts}
            onClose={() => setJarvisOpen(false)}
            className="nx-fade fixed inset-y-0 right-0 z-[56] w-full max-w-[380px] !rounded-none border-y-0 border-r-0 sm:inset-y-3 sm:right-3 sm:max-h-[calc(100vh-1.5rem)] sm:!rounded-[1.2rem] sm:border"
          />
        </>
      ) : null}

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
    </div>
  );
}
