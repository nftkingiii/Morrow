import { describe, expect, it } from "vitest";
import { commitmentFor, grantSchema, toBaseUnits } from "./grants";

describe("grant boundaries", () => {
  it("keeps claim and recovery commitments domain-separated", () => {
    const secret = "0x1234";
    expect(commitmentFor("claim", secret)).not.toEqual(commitmentFor("recovery", secret));
  });

  it("converts six-decimal token amounts exactly", () => {
    expect(toBaseUnits("850.125")).toBe("850125000");
    expect(toBaseUnits("0.000001")).toBe("1");
  });

  it("rejects over-precise and non-positive-looking inputs", () => {
    const result = grantSchema.safeParse({
      title: "A valid title",
      milestone: "A sufficiently concrete deliverable",
      amount: "12.0000001",
      deadline: "2026-09-01T10:00",
    });
    expect(result.success).toBe(false);
  });
});
