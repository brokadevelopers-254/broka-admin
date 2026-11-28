"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Lens = {
  id: string;
  label: string;
  hint?: string;
  /** A measured count shown beside the label, e.g. open decisions. Never invented. */
  count?: number;
  render: () => ReactNode;
};

/**
 * A workspace lens switcher for long analytical pages. It replaces a single
 * column of stacked sections with one deliberate view at a time, keeps full
 * keyboard semantics (arrow keys, Home/End), and mounts only the active lens so
 * hidden panels do not keep charts and queries alive.
 */
export function NexusLenses({ label, lenses, initial }: { label: string; lenses: Lens[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? lenses[0]?.id ?? "");
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = lenses.find((lens) => lens.id === active) ?? lenses[0];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = lenses.findIndex((lens) => lens.id === current?.id);
    if (index < 0) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % lenses.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + lenses.length) % lenses.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = lenses.length - 1;
    else return;
    event.preventDefault();
    const target = lenses[next];
    setActive(target.id);
    tabRefs.current[target.id]?.focus();
  }

  if (!current) return null;

  return (
    <section aria-label={label} className="space-y-4">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/25 p-1 [scrollbar-width:none]"
      >
        {lenses.map((lens) => {
          const selected = lens.id === current.id;
          return (
            <button
              key={lens.id}
              ref={(node) => { tabRefs.current[lens.id] = node; }}
              type="button"
              role="tab"
              id={`nx-lens-tab-${lens.id}`}
              aria-selected={selected}
              aria-controls={`nx-lens-panel-${lens.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(lens.id)}
              className={cn(
                "focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold transition",
                selected
                  ? "bg-[#947bff]/20 text-[#efeaff] shadow-[inset_0_0_0_1px_rgba(148,123,255,0.4)]"
                  : "text-slate-500 hover:bg-white/[0.03] hover:text-slate-200",
              )}
              title={lens.hint}
            >
              {lens.label}
              {typeof lens.count === "number" ? (
                <span className={cn("rounded-full px-1.5 py-px text-[9.5px] tabular-nums", selected ? "bg-white/12 text-white" : "bg-white/[0.06] text-slate-400")}>
                  {lens.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div
        key={current.id}
        role="tabpanel"
        id={`nx-lens-panel-${current.id}`}
        aria-labelledby={`nx-lens-tab-${current.id}`}
        tabIndex={0}
        className="nx-lens-panel focus-ring space-y-5 rounded-xl"
      >
        {current.render()}
      </div>
    </section>
  );
}
