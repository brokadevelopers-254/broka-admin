import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NexusMetricStrip } from "@/components/nexus/metric-strip";
import type { CommandCenter, CommandMetric } from "@/lib/api/schemas";
import { formatMetricValue } from "@/lib/command-center";

function metric(partial: Partial<CommandMetric> & Pick<CommandMetric, "key" | "label" | "value">): CommandMetric {
  return {
    kind: "period",
    unit: "count",
    good: "up",
    previous: null,
    delta: null,
    change_pct: null,
    definition: `${partial.key} definition`,
    caption: null,
    href: null,
    available: partial.value !== null,
    unavailable_reason: null,
    ...partial,
  };
}

/**
 * `marketplace.revenue` and `marketplace.deals` are deliberate decoys: an
 * implementation that searches by key alone would pick them up.
 */
function commandFixture(): CommandCenter {
  return {
    generated_at: "2026-11-28T06:00:00.000Z",
    window: {
      days: 7,
      from: "2026-11-21",
      to: "2026-11-28",
      previous_from: "2026-11-14",
      previous_to: "2026-11-21",
    },
    staff_excluded: true,
    activity_coverage_started_on: null,
    groups: [
      {
        key: "growth",
        title: "Growth",
        metrics: [
          metric({ key: "registered_users", label: "Registered users", value: 1200, kind: "point_in_time" }),
          metric({ key: "new_registrations", label: "New registrations", value: 84 }),
        ],
      },
      {
        key: "marketplace",
        title: "Marketplace",
        metrics: [
          metric({ key: "live_listings", label: "Live listings", value: 640, kind: "point_in_time" }),
          metric({ key: "new_listings", label: "New listings", value: 37 }),
          metric({ key: "deals_agreed", label: "Deals agreed", value: 12 }),
          // Decoys: same key names as the financial and deal figures.
          metric({ key: "revenue", label: "Not platform revenue", value: 999999 }),
          metric({ key: "deals", label: "All deals", value: 900 }),
        ],
      },
      {
        key: "financial",
        title: "Financial",
        metrics: [
          metric({ key: "revenue", label: "Platform revenue", value: 250000, unit: "kes_minor" }),
        ],
      },
    ],
  } as unknown as CommandCenter;
}

const SERIES = {
  gmv_minor: [
    { t: "2026-11-26T00:00:00.000Z", v: 9_000_000 },
    { t: "2026-11-27T00:00:00.000Z", v: 12_000_000 },
  ],
  signups: [
    { t: "2026-11-26T00:00:00.000Z", v: 10 },
    { t: "2026-11-27T00:00:00.000Z", v: 14 },
  ],
  listings_created: [
    { t: "2026-11-26T00:00:00.000Z", v: 4 },
    { t: "2026-11-27T00:00:00.000Z", v: 6 },
  ],
  deals_agreed: [
    { t: "2026-11-26T00:00:00.000Z", v: 1 },
    { t: "2026-11-27T00:00:00.000Z", v: 2 },
  ],
};

describe("NexusMetricStrip — measure accuracy", () => {
  it("never charts GMV as commission or platform revenue", () => {
    const { container } = render(<NexusMetricStrip command={commandFixture()} series={SERIES} windowDays={7} />);
    const revenue = screen.getByTestId("nx-metric-revenue");
    expect(revenue).toHaveAttribute("data-series-key", "none");
    expect(within(revenue).getByTestId("nx-spark-unavailable")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-series-key="gmv_minor"]')).toHaveLength(0);
    expect(revenue.textContent).not.toMatch(/9,000,000|12,000,000/);
    // The decoy marketplace.revenue must not become the revenue figure.
    expect(revenue.textContent).not.toContain("999,999");
    expect(revenue.textContent).toContain(formatMetricValue("kes_minor", 250000));
  });

  it("shows total users with the new-registration flow kept separate", () => {
    render(<NexusMetricStrip command={commandFixture()} series={SERIES} windowDays={7} />);
    const users = screen.getByTestId("nx-metric-users");
    expect(users).toHaveAttribute("data-series-key", "signups");
    expect(users.textContent).toContain("1,200");
    expect(screen.getByTestId("nx-metric-users-flow").textContent).toContain("84 new in this window");
    // The sparkline is labelled as registrations per day, not as the base.
    expect(within(users).getByTestId("nx-spark")).toHaveAttribute("data-series-key", "signups");
    expect(within(users).getByTestId("nx-spark").getAttribute("aria-label")).toMatch(/New registrations per day/);
  });

  it("shows live listings with the creation flow kept separate", () => {
    render(<NexusMetricStrip command={commandFixture()} series={SERIES} windowDays={7} />);
    const listings = screen.getByTestId("nx-metric-listings");
    expect(listings.textContent).toContain("640");
    expect(screen.getByTestId("nx-metric-listings-flow").textContent).toContain("37 created in this window");
    expect(within(listings).getByTestId("nx-spark")).toHaveAttribute("data-series-key", "listings_created");
  });

  it("charts deals from the deals-agreed series only", () => {
    render(<NexusMetricStrip command={commandFixture()} series={SERIES} windowDays={7} />);
    const deals = screen.getByTestId("nx-metric-deals");
    expect(within(deals).getByTestId("nx-spark")).toHaveAttribute("data-series-key", "deals_agreed");
    expect(within(deals).getByTestId("nx-spark").getAttribute("aria-label")).toMatch(/Deals agreed per day/);
    // Not the all-deals decoy.
    expect(deals.textContent).not.toContain("900");
  });

  it("states a missing series instead of substituting another one", () => {
    render(<NexusMetricStrip command={commandFixture()} series={{ gmv_minor: SERIES.gmv_minor }} windowDays={7} />);
    expect(screen.getAllByTestId("nx-spark-empty").length).toBe(3);
    expect(screen.getByTestId("nx-metric-revenue").textContent).toMatch(/No daily revenue series is served/);
  });

  it("does not invent a value when neither the contract nor the summary answered", () => {
    render(<NexusMetricStrip windowDays={7} />);
    expect(screen.getByTestId("nx-metric-users").textContent).toContain("—");
    expect(screen.getByTestId("nx-metric-revenue").textContent).toContain("—");
  });
});
