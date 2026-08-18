import { describe, expect, it } from "vitest";
import { atomicMilestoneSteps, privacyPreflight } from "./privacy";
import { describeStrk20Error, fundActions, highestSupportedWalletApi, raceWithTimeout, shieldActions, supportsWalletApi } from "./strk20";

describe("STRK20 wallet boundary", () => {
  it("accepts the stable minimum and newer Wallet API versions", () => {
    expect(supportsWalletApi(["0.10.3"])).toBe(true);
    expect(supportsWalletApi(["0.11.0"])).toBe(true);
    expect(supportsWalletApi(["0.10.2"])).toBe(false);
    expect(highestSupportedWalletApi(["0.10.3", "0.7.2"])).toBe("0.10.3");
  });

  it("builds a standalone shield action with a hexadecimal felt amount", () => {
    expect(shieldActions("0x123", "12.5")).toEqual([
      { type: "deposit", token: "0x123", amount: "0xbebc20" },
    ]);
  });

  it("uses the same hexadecimal felt for the atomic withdrawal and helper call", () => {
    const actions = fundActions(
      {
        escrowAddress: "0x456",
        tokenAddress: "0x123",
        explorerBaseUrl: "https://starkscan.co",
      },
      {
        claimCommitment: "0xabc",
        recoveryCommitment: "0xdef",
        amount: "12.5",
        deadline: "2026-12-31T00:00:00.000Z",
      },
    );

    expect(actions[0]).toEqual({ type: "withdraw", token: "0x123", amount: "0xbebc20", recipient: "0x456" });
    expect(actions[1]).toMatchObject({
      type: "invoke",
      contract: "0x456",
      calldata: expect.arrayContaining(["0", "0xabc", "0xdef", "0x123", "0xbebc20"]),
    });
  });

  it("turns a missing wallet registration into a safe recovery instruction", () => {
    expect(describeStrk20Error(new Error("An error occurred (NOT_REGISTERED)"))).toContain("Privacy flow");
  });

  it("fails a wallet request that never settles instead of leaving the UI pending", async () => {
    await expect(raceWithTimeout(new Promise<never>(() => undefined), 1, "Wallet connection timed out.")).rejects.toThrow(
      "Wallet connection timed out.",
    );
  });

  it("keeps shielding separate while describing funding as the atomic boundary", () => {
    expect(privacyPreflight("separate", "25").level).toBe("lower");
    expect(atomicMilestoneSteps().map((step) => step.status)).toEqual(["separate", "atomic", "planned"]);
  });
});
