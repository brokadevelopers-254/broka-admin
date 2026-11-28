"use client";

import {
  BarChart3,
  Bot,
  FileText,
  Gauge,
  MessageSquareWarning,
  Radar,
  Store,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  { href: "/intelligence", label: "Investigate", hint: "Founder intelligence", icon: Radar, accent: "text-[#c9beff]" },
  { href: "/reports", label: "Reports", hint: "Generated briefs", icon: FileText, accent: "text-[#8fe6f5]" },
  { href: "/complaints", label: "Review complaints", hint: "First-reply deadlines", icon: MessageSquareWarning, accent: "text-amber-200" },
  { href: "/market", label: "Marketplace", hint: "Rankings and demand", icon: Store, accent: "text-emerald-300" },
  { href: "/users", label: "Manage users", hint: "Accounts and trust", icon: Users, accent: "text-[#c9beff]" },
  { href: "/service-health", label: "Service health", hint: "Dependency probes", icon: Gauge, accent: "text-rose-200" },
] as const;

/** Every tile is a route into an existing, authorized workspace. */
export function NexusQuickActions({ className }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="nexus-quick-title">
      <div className="nx-panel p-4">
        <div className="relative flex items-center justify-between gap-2">
          <h2 id="nexus-quick-title" className="flex items-center gap-2 font-display text-[13px] font-bold text-white">
            <Zap size={13} className="text-amber-200" aria-hidden="true" /> Quick actions
          </h2>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="nx-quick focus-ring">
                <span className="nx-quick-icon" aria-hidden="true"><Icon size={15} className={action.accent} /></span>
                <span className="leading-tight">{action.label}</span>
                <span className="text-[9px] font-medium text-slate-600">{action.hint}</span>
              </Link>
            );
          })}
        </div>
        <Link href="/assistant" className="nx-jarvis-chip focus-ring mt-2.5">
          <Bot size={13} className="text-[#c9beff]" aria-hidden="true" />
          Launch Jarvis workspace
          <BarChart3 size={11} className="ml-auto text-slate-600" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
