import { describe, expect, it } from "vitest";
import { shieldActions, supportsWalletApi } from "./strk20";

describe("STRK20 wallet boundary", () => {
  it("accepts the stable minimum and newer Wallet API versions", () => {
    expect(supportsWalletApi(["0.10.3"])).toBe(true);
    expect(supportsWalletApi(["0.11.0"])).toBe(true);
    expect(supportsWalletApi(["0.10.2"])).toBe(false);
  });

  it("builds a standalone shield action in base units", () => {
    expect(shieldActions("0x123", "12.5")).toEqual([
      { type: "deposit", token: "0x123", amount: "12500000" },
    ]);
  });
});
