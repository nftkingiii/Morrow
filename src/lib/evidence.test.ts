import { describe, expect, it } from "vitest";
import { poolEvidenceFromReceipt } from "./evidence";

describe("public pool evidence", () => {
  it("accepts a succeeded USDC pool deposit and formats its public amount", () => {
    expect(poolEvidenceFromReceipt("0xabc", {
      finality_status: "ACCEPTED_ON_L2",
      execution_status: "SUCCEEDED",
      block_number: 42,
      events: [{
        from_address: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
        keys: ["0x1", "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb"],
        data: ["0x186a0"],
      }],
    })).toEqual({ hash: "0xabc", blockNumber: 42, amount: "0.100000" });
  });

  it("rejects failed receipts", () => {
    expect(poolEvidenceFromReceipt("0xabc", { finality_status: "ACCEPTED_ON_L2", execution_status: "REVERTED", block_number: 42 })).toBeNull();
  });

  it("keeps evidence valid when a receipt advances to L1 finality", () => {
    expect(poolEvidenceFromReceipt("0xabc", {
      finality_status: "ACCEPTED_ON_L1",
      execution_status: "SUCCEEDED",
      block_number: 43,
      events: [{
        from_address: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
        keys: ["0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb"],
        data: ["0x186a0"],
      }],
    })?.blockNumber).toBe(43);
  });
});
