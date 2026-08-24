import { afterEach, describe, expect, it, vi } from "vitest";
import { findMilestoneFunding, findMilestoneResolution, findShieldDeposit, poolEvidenceFromReceipt } from "./evidence";

afterEach(() => vi.restoreAllMocks());

describe("public pool evidence", () => {
  it("accepts a succeeded USDC pool deposit and formats its public amount", () => {
    expect(poolEvidenceFromReceipt("0xabc", {
      finality_status: "ACCEPTED_ON_L2",
      execution_status: "SUCCEEDED",
      block_number: 42,
      events: [{
        from_address: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
        keys: ["0x09149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2", "0xaccount", "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb"],
        data: ["0x186a0"],
      }],
    })).toEqual({ hash: "0xabc", blockNumber: 42, amount: "0.100000", kind: "shield" });
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
        keys: ["0x09149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2", "0xaccount", "0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb"],
        data: ["0x186a0"],
      }],
    })?.blockNumber).toBe(43);
  });

  it("classifies helper funding without mistaking a pool hash for USDC", () => {
    expect(poolEvidenceFromReceipt("0xfunded", {
      finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED", block_number: 100,
      events: [{
        from_address: "0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3",
        keys: ["0x02f074006c0487e45d8ca03da01ac02b726886643bff065e5ab946e9b7b925e4", "0xcommitment"],
        data: ["0x033068f6539f8e6e6b131e6b2b814e6c34a5224bc66947c47dab9dfee93b35fb", "0xc350", "0xexpiry"],
      }, { from_address: "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a", keys: ["0xother"], data: ["0xffffffffffffffffffff"] }],
    })).toEqual({ hash: "0xfunded", blockNumber: 100, amount: "0.050000", kind: "milestone-funded" });
  });

  it("classifies a succeeded helper resolution and preserves its claimed state", () => {
    expect(poolEvidenceFromReceipt("0xclaimed", {
      finality_status: "ACCEPTED_ON_L2", execution_status: "SUCCEEDED", block_number: 101,
      events: [{
        from_address: "0x073d8af97693e5744fb46c994e1cfabf9815e3044cdca6253e239d922f9bae3",
        keys: ["0x0e1c89f14bdcf8dab60de3ccdedbd4d210d19ab23e1fc13c72ab83417bf8b4e", "0xabc"],
        data: ["0x2"],
      }],
    })).toEqual({ hash: "0xclaimed", blockNumber: 101, kind: "milestone-claimed" });
  });

  it("recovers a shield transaction from its account-indexed Deposit event", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: "starknet_getEvents",
      result: {
        events: [{
          block_number: 99,
          transaction_hash: "0xshield",
          keys: ["0x9149d2123147c5f43d258257fef0b7b969db78269369ebcf5ebb9eef8592f2", "0xabc", "0x123"],
          data: ["0x186a0"],
        }],
      },
    })));

    await expect(findShieldDeposit("https://rpc.invalid", "0xabc", "0x123", "0x186a0", 90)).resolves.toEqual({
      hash: "0xshield",
      blockNumber: 99,
      amount: "0.100000",
      kind: "shield",
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.params.filter.keys[1]).toEqual(["0xabc"]);
    expect(body.params.filter.from_block).toEqual({ block_number: 90 });
  });

  it("recovers timed-out funding from the commitment-indexed helper event", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: "starknet_getEvents",
      result: { events: [{ block_number: 100, transaction_hash: "0xfunded", keys: ["0xevent", "0xabc"], data: ["0xtoken", "0xc350", "0xexpiry"] }] },
    })));
    await expect(findMilestoneFunding("https://rpc.invalid", "0xescrow", "0xabc", 90)).resolves.toEqual({
      hash: "0xfunded",
      blockNumber: 100,
      amount: "0.050000",
      kind: "milestone-funded",
    });
  });

  it("recovers a timed-out claim from the commitment-indexed resolution event", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: "starknet_getEvents",
      result: { events: [{ block_number: 101, transaction_hash: "0xclaimed", keys: ["0xevent", "0xabc"], data: ["0x2"] }] },
    })));
    await expect(findMilestoneResolution("https://rpc.invalid", "0xescrow", "0xabc", "claim", 90)).resolves.toEqual({
      hash: "0xclaimed",
      blockNumber: 101,
      kind: "milestone-claimed",
    });
  });
});
