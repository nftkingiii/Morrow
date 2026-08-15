import { describe, expect, it } from "vitest";
import { privacyPreflight } from "./privacy";

describe("privacy preflight", () => {
  it("flags a bundled deposit as directly linkable", () => {
    const report = privacyPreflight("bundled", "850");
    expect(report.level).toBe("high");
    expect(report.summary).toContain("850 USDC");
    expect(report.summary).toContain("publicly aligns");
  });

  it("recommends separate shielding without inventing a live anonymity score", () => {
    const report = privacyPreflight("separate");
    expect(report.level).toBe("lower");
    expect(report.publicSignals.join(" ")).toContain("does not calculate a live anonymity set");
  });
});
