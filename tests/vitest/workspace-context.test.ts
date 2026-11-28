import { describe, expect, it } from "vitest";

import { workspaceContextFor } from "@/lib/nexus/workspace-context";

describe("workspaceContextFor", () => {
  it("scopes Jarvis to the workspace's own insight areas", () => {
    expect(workspaceContextFor("/market").key).toBe("marketplace");
    expect(workspaceContextFor("/market").areas).toContain("liquidity");
    expect(workspaceContextFor("/complaints").areas).toEqual(["trust"]);
    expect(workspaceContextFor("/operations").areas).toContain("operations");
    expect(workspaceContextFor("/growth").areas).toContain("growth");
  });

  it("matches nested routes but not a sibling with a shared prefix", () => {
    expect(workspaceContextFor("/reports/builder").key).toBe("reports");
    expect(workspaceContextFor("/revenue").key).toBe("business");
    // /reporting is not /reports.
    expect(workspaceContextFor("/reporting").key).toBe("platform");
  });

  it("falls back to the whole platform on the Command Center and unknown routes", () => {
    expect(workspaceContextFor("/").key).toBe("platform");
    expect(workspaceContextFor("/").areas).toBeNull();
    expect(workspaceContextFor("/settings").areas).toBeNull();
  });

  it("only offers prefill prompts, never canned answers", () => {
    const prompts = workspaceContextFor("/market").prompts;
    expect(prompts.length).toBeGreaterThan(0);
    for (const prompt of prompts) expect(prompt.trim().endsWith("?")).toBe(true);
  });
});
