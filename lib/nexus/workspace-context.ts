// What Jarvis can see, and what it should offer to explain, on each route.
//
// This is presentation metadata only: it names the workspace, which backend
// insight areas belong to it, and a few questions to prefill. It never
// invents an answer, a metric or a signal. When the insight feed returns
// nothing for these areas, the panel says exactly that.

export type WorkspaceContext = {
  key: string;
  /** Human name used in Jarvis copy, e.g. "Marketplace Intelligence". */
  label: string;
  /** Backend insight areas this workspace explains. null = every area. */
  areas: readonly string[] | null;
  /** Questions that only prefill the composer. They are never auto-sent. */
  prompts: readonly string[];
};

type Rule = { prefixes: readonly string[]; context: WorkspaceContext };

const CONTEXTS: readonly Rule[] = [
  {
    prefixes: ["/market", "/assistant/marketplace"],
    context: {
      key: "marketplace",
      label: "Marketplace Intelligence",
      areas: ["liquidity", "supply", "demand", "sellers", "marketplace"],
      prompts: [
        "Which categories show unserved demand or undersupply?",
        "Which listings are not converting?",
        "How is seller reply speed affecting deals?",
      ],
    },
  },
  {
    prefixes: ["/growth", "/assistant/business"],
    context: {
      key: "growth",
      label: "Growth",
      areas: ["growth", "targets", "sellers", "business"],
      prompts: [
        "Which growth targets are behind, and what explains the gap?",
        "Where is acquisition converting least well?",
      ],
    },
  },
  {
    prefixes: ["/intelligence", "/assistant/core"],
    context: {
      key: "intelligence",
      label: "Intelligence Core",
      areas: null,
      prompts: [
        "What changed most in this window, and why?",
        "Which signals need a founder decision first?",
      ],
    },
  },
  {
    prefixes: ["/revenue", "/production-costs", "/finance-integrity", "/assistant/business"],
    context: {
      key: "business",
      label: "Business Intelligence",
      areas: ["money", "targets"],
      prompts: [
        "How do platform income and recorded costs compare this window?",
        "What is the gap between recognised commission and ledger revenue?",
      ],
    },
  },
  {
    prefixes: ["/operations", "/service-health"],
    context: {
      key: "operations",
      label: "Operations Intelligence",
      areas: ["operations", "payments"],
      prompts: [
        "Which operational figures are outside their normal range?",
        "Is API latency rising, and where?",
      ],
    },
  },
  {
    prefixes: ["/complaints", "/email-reply", "/communications", "/alerts"],
    context: {
      key: "trust",
      label: "Trust & Safety",
      areas: ["trust"],
      prompts: [
        "Which trust and safety signals need an administrator first?",
        "Are complaints slipping past their reply deadline?",
      ],
    },
  },
  {
    prefixes: ["/fraud", "/disputes"],
    context: {
      key: "trust",
      label: "Trust & Safety",
      areas: ["trust"],
      prompts: ["Which accounts or disputes need review first?"],
    },
  },
  {
    prefixes: ["/reports", "/reports/builder"],
    context: {
      key: "reports",
      label: "Reports",
      areas: null,
      prompts: ["Which figures moved most since the last report?"],
    },
  },
  {
    prefixes: ["/users", "/analytics/users"],
    context: {
      key: "users",
      label: "User Intelligence",
      areas: ["growth", "sellers", "trust"],
      prompts: [
        "Who returns, and who signs up without engaging?",
        "Which sellers are slowest to reply?",
      ],
    },
  },
];

const DEFAULT_CONTEXT: WorkspaceContext = {
  key: "platform",
  label: "the Command Center",
  areas: null,
  prompts: [
    "How did the business perform this window compared with the previous one?",
    "Which signals need a decision first?",
  ],
};

/** The workspace a path belongs to. Longest matching prefix wins. */
export function workspaceContextFor(pathname: string): WorkspaceContext {
  if (pathname === "/" || pathname === "") return DEFAULT_CONTEXT;
  let best: { context: WorkspaceContext; length: number } | null = null;
  for (const rule of CONTEXTS) {
    for (const prefix of rule.prefixes) {
      const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (matches && (!best || prefix.length > best.length)) {
        best = { context: rule.context, length: prefix.length };
      }
    }
  }
  return best?.context ?? DEFAULT_CONTEXT;
}
